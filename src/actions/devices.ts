"use server";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requirePerformer } from "@/lib/auth";
import { broadcastDeviceCommand } from "@/lib/supabase/server";
import {
  DEVICE_ROLES,
  isCommandType,
  validatePayload,
  type CommandType,
  type DeviceRole,
  type LiveCommandEvent,
} from "@/lib/liveControl/events";
import type { Prisma } from "@/generated/prisma/client";

// Live score control (iPhone controller -> iPad forScore receiver). Every
// action here re-checks that the device/command belongs to the signed-in
// performer: device ids travel through the browser, so a guessed or
// tampered id must never reach someone else's device.

// A receiver counts as online if its heartbeat (every 30s while its
// Realtime subscription is up) arrived within this window.
const ONLINE_WINDOW_MS = 75_000;
// A receiver that reconnects picks up a missed command only if it is this
// fresh — anything older would open a score the performer has moved past.
const CATCH_UP_WINDOW_MS = 30_000;

export type ReceiverSummary = { id: string; name: string; online: boolean; lastSeenAt: string | null };
export type ReceiverState = { receivers: ReceiverSummary[]; selectedId: string | null };

function isOnline(lastSeenAt: Date | null) {
  return !!lastSeenAt && Date.now() - lastSeenAt.getTime() < ONLINE_WINDOW_MS;
}

async function findOwnedDevice(performerId: string, deviceId: string) {
  const device = await prisma.performerDevice.findFirst({ where: { id: deviceId, performerId } });
  if (!device) throw new Error("Device not found.");
  return device;
}

// Creates this browser's device, or updates it if the id it remembers is
// still one of this performer's (a shared iPad signed into another
// account gets a fresh device instead). Receivers get their secret
// channel topic back; controllers never see any device's token.
export async function registerDevice(input: { deviceId: string | null; name: string; role: DeviceRole }) {
  const performer = await requirePerformer();
  const name = input.name.trim().slice(0, 60);
  if (!name) throw new Error("Give this device a name.");
  if (!DEVICE_ROLES.includes(input.role)) throw new Error("Unknown device role.");

  const existing = input.deviceId
    ? await prisma.performerDevice.findFirst({ where: { id: input.deviceId, performerId: performer.id } })
    : null;
  const device = existing
    ? await prisma.performerDevice.update({ where: { id: existing.id }, data: { name, role: input.role } })
    : await prisma.performerDevice.create({
        data: { performerId: performer.id, name, role: input.role, channelToken: randomBytes(24).toString("hex") },
      });

  return {
    deviceId: device.id,
    deviceName: device.name,
    deviceRole: device.role as DeviceRole,
    channelToken: device.role === "controller" ? null : device.channelToken,
  };
}

// The receiver page's startup call: its token, or null if the remembered
// device is gone / belongs to another login / isn't a receiver.
export async function getReceiverChannel(deviceId: string) {
  const performer = await requirePerformer();
  const device = await prisma.performerDevice.findFirst({
    where: { id: deviceId, performerId: performer.id, role: "forscore_receiver" },
  });
  return device ? { deviceName: device.name, channelToken: device.channelToken } : null;
}

// The secret address an iPad Shortcut (or the laptop's Ableton helper) polls
// (src/app/api/live-control/next).
export async function getShortcutToken(deviceId: string) {
  const performer = await requirePerformer();
  const device = await prisma.performerDevice.findFirst({
    where: { id: deviceId, performerId: performer.id, role: { in: ["forscore_receiver", "ableton_receiver"] } },
  });
  if (!device) throw new Error("Device not found.");
  return device.channelToken;
}

export async function deviceHeartbeat(deviceId: string) {
  const performer = await requirePerformer();
  const { count } = await prisma.performerDevice.updateMany({
    where: { id: deviceId, performerId: performer.id },
    data: { lastSeenAt: new Date() },
  });
  if (count === 0) throw new Error("Device not found.");
}

// The performer's receivers, plus the one every controller sends to
// (Settings.forScoreReceiverId — one choice for the whole account, made on
// the Settings page).
export async function listReceivers(): Promise<ReceiverState> {
  const performer = await requirePerformer();
  const [devices, settings] = await Promise.all([
    prisma.performerDevice.findMany({
      where: { performerId: performer.id, role: "forscore_receiver" },
      orderBy: { name: "asc" },
    }),
    prisma.settings.findUnique({ where: { performerId: performer.id }, select: { forScoreReceiverId: true } }),
  ]);
  return {
    receivers: devices.map((d) => ({
      id: d.id,
      name: d.name,
      online: isOnline(d.lastSeenAt),
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
    })),
    selectedId: settings?.forScoreReceiverId ?? null,
  };
}

export async function setForScoreReceiver(deviceId: string | null) {
  const performer = await requirePerformer();
  if (deviceId) {
    const count = await prisma.performerDevice.count({
      where: { id: deviceId, performerId: performer.id, role: "forscore_receiver" },
    });
    if (count === 0) throw new Error("Device not found.");
  }
  await prisma.settings.upsert({
    where: { performerId: performer.id },
    create: { performerId: performer.id, forScoreReceiverId: deviceId },
    update: { forScoreReceiverId: deviceId },
  });
}

export async function removeDevice(deviceId: string) {
  const performer = await requirePerformer();
  await findOwnedDevice(performer.id, deviceId);
  await prisma.performerDevice.delete({ where: { id: deviceId } });
}

export type SendResult =
  | { ok: true; eventId: string; deviceName: string; online: boolean }
  | { ok: false; error: string };

// Returns errors as values rather than throwing: production redacts thrown
// Server Action messages, and the controller needs to show these.
export async function sendDeviceCommand(input: {
  targetDeviceId: string;
  sourceDeviceId: string | null;
  type: CommandType;
  payload: unknown;
}): Promise<SendResult> {
  const performer = await requirePerformer();
  if (!isCommandType(input.type)) return { ok: false, error: "Unknown command." };

  let payload;
  try {
    payload = validatePayload(input.type, input.payload);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid command." };
  }

  const target = await prisma.performerDevice.findFirst({
    where: { id: input.targetDeviceId, performerId: performer.id, role: "forscore_receiver" },
  });
  if (!target) return { ok: false, error: "That forScore receiver no longer exists — pick another." };

  const command = await prisma.deviceCommand.create({
    data: {
      performerId: performer.id,
      targetDeviceId: target.id,
      sourceDeviceId: input.sourceDeviceId,
      type: input.type,
      payload: payload as Prisma.InputJsonValue,
    },
  });

  const event: LiveCommandEvent = {
    eventId: command.id,
    type: input.type,
    performerId: performer.id,
    targetDeviceId: target.id,
    sourceDeviceId: input.sourceDeviceId,
    payload,
    sentAt: command.createdAt.toISOString(),
  };
  try {
    await broadcastDeviceCommand(target.channelToken, event);
  } catch {
    return { ok: false, error: "Couldn't reach the realtime service — try again." };
  }
  return { ok: true, eventId: command.id, deviceName: target.name, online: isOnline(target.lastSeenAt) };
}

// Ableton receivers (the laptop's guitar-pad helper). Unlike forScore there's
// no "which one" choice: every Ableton receiver gets every cue — in
// practice there's one, the gig laptop.
export async function listAbletonReceivers(): Promise<ReceiverSummary[]> {
  const performer = await requirePerformer();
  const devices = await prisma.performerDevice.findMany({
    where: { performerId: performer.id, role: "ableton_receiver" },
    orderBy: { name: "asc" },
  });
  return devices.map((d) => ({
    id: d.id,
    name: d.name,
    online: isOnline(d.lastSeenAt),
    lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
  }));
}

// Cues a song's scene in Ableton. The receivers long-poll for it, so there's
// nothing to broadcast. Fire-and-forget from the Live Queue: returns
// whether any Ableton receiver exists rather than throwing.
export async function cueAbletonScene(input: { action: "select" | "launch"; songName: string; artistName: string }) {
  const performer = await requirePerformer();
  let payload;
  try {
    payload = validatePayload("ableton.cue_scene", input);
  } catch {
    return { ok: false as const };
  }
  const receivers = await prisma.performerDevice.findMany({
    where: { performerId: performer.id, role: "ableton_receiver" },
    select: { id: true },
  });
  if (receivers.length === 0) return { ok: false as const };
  await prisma.deviceCommand.createMany({
    data: receivers.map((r) => ({
      performerId: performer.id,
      targetDeviceId: r.id,
      sourceDeviceId: null,
      type: "ableton.cue_scene",
      payload: payload as Prisma.InputJsonValue,
    })),
  });
  return { ok: true as const };
}

// Receiver -> server: "I got it". Lets the controller confirm delivery.
export async function ackDeviceCommand(deviceId: string, eventId: string) {
  const performer = await requirePerformer();
  await prisma.deviceCommand.updateMany({
    where: { id: eventId, targetDeviceId: deviceId, performerId: performer.id, deliveredAt: null },
    data: { deliveredAt: new Date() },
  });
}

export async function getCommandStatus(eventId: string) {
  const performer = await requirePerformer();
  const command = await prisma.deviceCommand.findFirst({
    where: { id: eventId, performerId: performer.id },
    select: { deliveredAt: true },
  });
  return { delivered: !!command?.deliveredAt };
}

// For a receiver that just (re)connected: unacknowledged commands from the
// last few seconds, newest first. It opens only the newest.
export async function getMissedCommands(deviceId: string): Promise<LiveCommandEvent[]> {
  const performer = await requirePerformer();
  const commands = await prisma.deviceCommand.findMany({
    where: {
      targetDeviceId: deviceId,
      performerId: performer.id,
      deliveredAt: null,
      createdAt: { gt: new Date(Date.now() - CATCH_UP_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return commands.map((c) => ({
    eventId: c.id,
    type: c.type as CommandType,
    performerId: c.performerId,
    targetDeviceId: c.targetDeviceId,
    sourceDeviceId: c.sourceDeviceId,
    payload: c.payload as LiveCommandEvent["payload"],
    sentAt: c.createdAt.toISOString(),
  }));
}
