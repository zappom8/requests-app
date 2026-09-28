"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCommandStatus,
  listReceivers,
  sendDeviceCommand,
  setForScoreReceiver,
  type ReceiverSummary,
} from "@/actions/devices";
import { getLocalDevice } from "./localDevice";
import type { CommandPayloads } from "./events";

// Controller side of live score control: the performer's forScore
// receivers with online/offline state, the one every controller sends to
// (an account-wide setting, chosen on the Settings page), and
// send-with-feedback.

const RECEIVER_REFRESH_MS = 20_000;
const CONFIRM_POLL_MS = 400;
const CONFIRM_TIMEOUT_MS = 5_000;

export type LiveControlNotice = { text: string; tone: "ok" | "pending" | "error" };

export function useLiveControl() {
  const [receivers, setReceivers] = useState<ReceiverSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedIdState] = useState<string | null>(null);
  const [notice, setNotice] = useState<LiveControlNotice | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendSeq = useRef(0);

  const refresh = useCallback(
    () =>
      listReceivers()
        .then((state) => {
          setReceivers(state.receivers);
          setSelectedIdState(state.selectedId);
          setLoaded(true);
        })
        // offline or signed out — keep showing the last known list
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, RECEIVER_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // The chosen receiver if it still exists, else the only one there is.
  const selected =
    receivers.find((r) => r.id === selectedId) ?? (receivers.length === 1 ? receivers[0] : null);

  async function selectReceiver(id: string | null) {
    setSelectedIdState(id);
    await setForScoreReceiver(id);
  }

  function showNotice(next: LiveControlNotice, clearAfterMs: number | null) {
    setNotice(next);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    if (clearAfterMs) noticeTimer.current = setTimeout(() => setNotice(null), clearAfterMs);
  }

  async function openScore(payload: { [K in keyof CommandPayloads["forscore.open_score"]]?: string | null }) {
    if (!payload.title && !payload.filename) {
      showNotice({ text: "No forScore score has been linked to this song yet.", tone: "error" }, 4000);
      return;
    }
    if (!selected) {
      showNotice(
        {
          text:
            receivers.length === 0
              ? "No forScore receiver is currently connected."
              : "Choose your forScore receiver on the Settings page.",
          tone: "error",
        },
        5000,
      );
      return;
    }

    const seq = ++sendSeq.current;
    showNotice({ text: `Sending to ${selected.name}…`, tone: "pending" }, null);
    let result;
    try {
      result = await sendDeviceCommand({
        targetDeviceId: selected.id,
        sourceDeviceId: getLocalDevice()?.deviceId ?? null,
        type: "forscore.open_score",
        payload,
      });
    } catch {
      showNotice({ text: "Couldn't reach the server — check this phone's connection.", tone: "error" }, 5000);
      return;
    }
    if (!result.ok) {
      showNotice({ text: result.error, tone: "error" }, 5000);
      void refresh();
      return;
    }

    const deviceName = result.deviceName;
    showNotice(
      {
        text: result.online ? `Sent to ${deviceName}` : `Sent to ${deviceName} — but it looks offline`,
        tone: result.online ? "pending" : "error",
      },
      null,
    );

    // Wait briefly for the receiver's acknowledgement — the key signal for
    // judging how reliable Safari-in-Stage-Manager is at a gig.
    const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, CONFIRM_POLL_MS));
      if (seq !== sendSeq.current) return; // a newer send took over the notice
      try {
        if ((await getCommandStatus(result.eventId)).delivered) {
          showNotice({ text: `✓ ${deviceName} received it`, tone: "ok" }, 3000);
          return;
        }
      } catch {}
    }
    if (seq === sendSeq.current) {
      showNotice({ text: `${deviceName} didn't confirm — is the receiver page still open?`, tone: "error" }, 6000);
      void refresh();
    }
  }

  return { receivers, loaded, selected, selectReceiver, refresh, openScore, notice };
}
