import { prisma } from "@/lib/prisma";
import { buildForScoreOpenUrl } from "@/lib/liveControl/forscoreUrl";
import type { CommandPayloads } from "@/lib/liveControl/events";

// The iPad Shortcuts receiver: an Apple Shortcut loops "Get Contents of URL"
// on this address, then "Open URLs" on whatever comes back. Unlike Safari,
// Shortcuts opens forscore:// links without an "Open in forScore?" prompt.
//
// Long poll: holds the request open until a command for this device arrives
// (answered with its forscore:// URL as plain text) or WAIT_MS passes
// (answered with an empty body, and the Shortcut just asks again).
// ?wait=<seconds> shortens the hold (0–20) — iPhones seem less tolerant of
// a Shortcut action waiting a long time in the background. No login —
// a Shortcut has no session — so the device's secret channelToken in the
// path is the credential, the same secret the Safari receiver listens on.
// Each poll also counts as the device's heartbeat (online/offline).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_WAIT_MS = 20_000;
const CHECK_EVERY_MS = 150;
// Same freshness rule as getMissedCommands: never open a stale score.
const FRESH_MS = 30_000;

async function claimNextCommand(deviceId: string) {
  const commands = await prisma.deviceCommand.findMany({
    where: { targetDeviceId: deviceId, deliveredAt: null, createdAt: { gt: new Date(Date.now() - FRESH_MS) } },
    orderBy: { createdAt: "desc" },
  });
  if (commands.length === 0) return null;
  const [newest, ...older] = commands;
  const now = new Date();
  // Only the newest matters; older ones were superseded while nobody asked.
  if (older.length > 0) {
    await prisma.deviceCommand.updateMany({ where: { id: { in: older.map((c) => c.id) } }, data: { deliveredAt: now } });
  }
  // Claim atomically so two overlapping polls can't both open it.
  const { count } = await prisma.deviceCommand.updateMany({
    where: { id: newest.id, deliveredAt: null },
    data: { deliveredAt: now },
  });
  return count === 1 ? newest : null;
}

function text(body: string, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const device = await prisma.performerDevice.findUnique({ where: { channelToken: token } });
  if (!device || device.role !== "forscore_receiver") return text("Unknown receiver", 404);

  await prisma.performerDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  const waitParam = new URL(request.url).searchParams.get("wait");
  const waitSeconds = waitParam === null ? NaN : Number(waitParam);
  const waitMs = waitSeconds >= 0 ? Math.min(waitSeconds * 1000, MAX_WAIT_MS) : MAX_WAIT_MS;
  const deadline = Date.now() + waitMs;
  while (!request.signal.aborted) {
    const command = await claimNextCommand(device.id);
    if (command) {
      if (command.type === "forscore.open_score") {
        return text(buildForScoreOpenUrl(command.payload as CommandPayloads["forscore.open_score"]));
      }
      continue; // a command type this receiver can't act on
    }
    if (Date.now() >= deadline) break;
    await new Promise((r) => setTimeout(r, CHECK_EVERY_MS));
  }
  return text("");
}
