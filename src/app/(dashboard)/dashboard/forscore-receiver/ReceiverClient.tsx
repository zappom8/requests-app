"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ackDeviceCommand, deviceHeartbeat, getMissedCommands, getReceiverChannel, registerDevice } from "@/actions/devices";
import {
  deviceChannelName,
  LIVE_COMMAND_EVENT,
  type CommandPayloads,
  type LiveCommandEvent,
} from "@/lib/liveControl/events";
import { buildForScoreOpenUrl } from "@/lib/liveControl/forscoreUrl";
import { getLocalDevice, setLocalDevice } from "@/lib/liveControl/localDevice";

// Heartbeat while subscribed; the controller shows "online" for 75s after.
const HEARTBEAT_MS = 30_000;
// A cheap tick that notices when iPadOS froze the page (the gap between
// ticks jumps) — logged, and the connection is re-checked straight away.
const TICK_MS = 5_000;
const SUSPEND_GAP_MS = 15_000;
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 20_000];
const SEEN_KEY = "liveControl.seenEventIds";
const LOG_KEY = "liveControl.receiverLog";
const MAX_SEEN = 50;
const MAX_LOG = 100;

type Status = "starting" | "setup" | "connecting" | "connected" | "reconnecting" | "offline";
type LogEntry = { at: string; text: string };
type LastCommand = { title: string; url: string; at: string };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

export default function ReceiverClient() {
  const [status, setStatus] = useState<Status>("starting");
  const [device, setDevice] = useState<{ deviceId: string; deviceName: string; channelToken: string } | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<LastCommand | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const logRef = useRef<LogEntry[]>([]);
  function addLog(text: string) {
    const entry = { at: new Date().toISOString(), text };
    console.log(`[forScore receiver] ${text}`);
    logRef.current = [entry, ...logRef.current].slice(0, MAX_LOG);
    writeJson(LOG_KEY, logRef.current);
    setLog(logRef.current);
  }

  // Startup: resume as the device this browser remembers, else ask for a name.
  useEffect(() => {
    logRef.current = readJson<LogEntry[]>(LOG_KEY, []);
    setLog(logRef.current);
    const local = getLocalDevice();
    setNameInput(local?.deviceName ?? "");
    if (!local || local.deviceRole !== "forscore_receiver") {
      setStatus("setup");
      return;
    }
    getReceiverChannel(local.deviceId)
      .then((channel) => {
        if (!channel) {
          setStatus("setup");
          return;
        }
        setDevice({ deviceId: local.deviceId, deviceName: channel.deviceName, channelToken: channel.channelToken });
      })
      .catch(() => {
        setSetupError("Couldn't reach the server. Check the iPad's connection, then reload.");
        setStatus("offline");
      });
  }, []);

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setSetupError(null);
    try {
      const result = await registerDevice({
        deviceId: getLocalDevice()?.deviceId ?? null,
        name: nameInput,
        role: "forscore_receiver",
      });
      setLocalDevice({ deviceId: result.deviceId, deviceName: result.deviceName, deviceRole: result.deviceRole });
      addLog(`Registered as "${result.deviceName}"`);
      setDevice({ deviceId: result.deviceId, deviceName: result.deviceName, channelToken: result.channelToken! });
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Couldn't register this device.");
    }
  }

  // The connection itself. Everything lives in this one effect so a
  // reconnect never races a stale closure.
  useEffect(() => {
    if (!device) return;
    const { deviceId, channelToken } = device;
    let disposed = false;
    let supabase: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;
    let subscribed = false;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let lastTick = Date.now();
    let lastHeartbeatAt = 0;
    let wakeLock: { release: () => Promise<void> } | null = null;
    const seen = new Set(readJson<string[]>(SEEN_KEY, []));

    function markSeen(eventId: string) {
      seen.add(eventId);
      writeJson(SEEN_KEY, [...seen].slice(-MAX_SEEN));
    }

    function handleCommand(event: LiveCommandEvent, source: "live" | "catch-up") {
      if (!event || event.targetDeviceId !== deviceId) {
        addLog("Ignored a command addressed to another device");
        return;
      }
      if (seen.has(event.eventId)) return; // duplicate delivery
      markSeen(event.eventId);
      void ackDeviceCommand(deviceId, event.eventId).catch(() => addLog("Couldn't acknowledge command"));

      if (event.type === "forscore.open_score") {
        const payload = event.payload as CommandPayloads["forscore.open_score"];
        const url = buildForScoreOpenUrl(payload);
        const lag = Date.now() - new Date(event.sentAt).getTime();
        addLog(`${source === "catch-up" ? "Caught up: " : ""}Open "${payload.title}" (${lag} ms after send) → ${url}`);
        setLastCommand({ title: payload.title, url, at: new Date().toISOString() });
        window.location.href = url;
      } else {
        addLog(`Unsupported command: ${event.type}`);
      }
    }

    async function heartbeat() {
      try {
        await deviceHeartbeat(deviceId);
        lastHeartbeatAt = Date.now();
        setLastHeartbeat(new Date().toISOString());
      } catch {
        addLog("Heartbeat failed — server unreachable?");
      }
    }

    // A command sent while this page was frozen or disconnected: open only
    // the newest (the server only returns ones from the last 30s).
    async function catchUp() {
      try {
        const missed = (await getMissedCommands(deviceId)).filter((c) => !seen.has(c.eventId));
        if (missed.length === 0) return;
        for (const older of missed.slice(1)) {
          markSeen(older.eventId);
          void ackDeviceCommand(deviceId, older.eventId).catch(() => {});
          addLog(`Skipped older missed command "${"title" in older.payload ? older.payload.title : older.type}"`);
        }
        handleCommand(missed[0], "catch-up");
      } catch {
        addLog("Couldn't check for missed commands");
      }
    }

    function scheduleReconnect(reason: string) {
      if (disposed || reconnectTimer) return;
      const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
      reconnectAttempt++;
      addLog(`${reason} — reconnecting in ${delay / 1000}s`);
      setStatus(navigator.onLine ? "reconnecting" : "offline");
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    }

    function connect() {
      if (disposed) return;
      if (channel && supabase) void supabase.removeChannel(channel);
      subscribed = false;
      supabase ??= getSupabaseBrowserClient();
      setStatus((s) => (s === "connected" || s === "starting" ? "connecting" : s));
      const thisChannel = supabase
        .channel(deviceChannelName(channelToken))
        .on("broadcast", { event: LIVE_COMMAND_EVENT }, ({ payload }) => handleCommand(payload as LiveCommandEvent, "live"));
      channel = thisChannel;
      thisChannel.subscribe((state) => {
        if (disposed || channel !== thisChannel) return;
        if (state === "SUBSCRIBED") {
          subscribed = true;
          reconnectAttempt = 0;
          setStatus("connected");
          addLog("Connected");
          void heartbeat();
          void catchUp();
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          subscribed = false;
          scheduleReconnect(`Connection ${state.toLowerCase().replace("_", " ")}`);
        }
      });
    }

    function isHealthy() {
      return subscribed && channel?.state === "joined" && !!supabase?.realtime.isConnected();
    }

    // Safari came back (focus, page shown again, network back, or the tick
    // noticed a freeze): reconnect if the socket died, else just re-sync.
    function recheck(reason: string) {
      if (disposed) return;
      if (!isHealthy()) {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = null;
        reconnectAttempt = 0;
        addLog(`${reason} — connection was lost, reconnecting`);
        connect();
      } else {
        void heartbeat();
        void catchUp();
      }
      void requestWakeLock();
    }

    async function requestWakeLock() {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
        if (!wakeLock && nav.wakeLock && document.visibilityState === "visible") {
          wakeLock = await nav.wakeLock.request("screen");
          (wakeLock as unknown as EventTarget).addEventListener?.("release", () => (wakeLock = null));
        }
      } catch {}
    }

    const tick = setInterval(() => {
      const now = Date.now();
      const gap = now - lastTick;
      lastTick = now;
      if (gap > SUSPEND_GAP_MS) {
        addLog(`Page was frozen for ~${Math.round(gap / 1000)}s`);
        recheck("Resumed");
      } else if (subscribed && now - lastHeartbeatAt >= HEARTBEAT_MS) {
        if (isHealthy()) void heartbeat();
        else recheck("Watchdog");
      }
    }, TICK_MS);

    const onVisibility = () => {
      addLog(`Safari page ${document.visibilityState}`);
      if (document.visibilityState === "visible") recheck("Page visible");
    };
    const onPageShow = () => recheck("Page shown");
    const onFocus = () => recheck("Safari focused");
    const onOnline = () => {
      addLog("Network back online");
      recheck("Online");
    };
    const onOffline = () => {
      addLog("Network offline");
      setStatus("offline");
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    connect();
    void requestWakeLock();

    return () => {
      disposed = true;
      clearInterval(tick);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (channel && supabase) void supabase.removeChannel(channel);
      void wakeLock?.release().catch(() => {});
    };
  }, [device]);

  if (status === "starting") return <p className="text-sm text-foreground-muted">Starting…</p>;

  if (status === "setup" || (!device && status !== "offline")) {
    return (
      <form onSubmit={handleSetup} className="max-w-sm space-y-2 text-sm">
        <p className="font-semibold">Set up this iPad as a forScore receiver</p>
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="e.g. Mitch iPad"
          autoFocus
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
        />
        <button type="submit" className="w-full rounded-lg bg-accent px-3 py-2 font-semibold text-accent-foreground">
          Start receiver
        </button>
        {setupError && <p className="text-danger">{setupError}</p>}
      </form>
    );
  }

  const statusText: Record<Status, string> = {
    starting: "Starting",
    setup: "Not set up",
    connecting: "Connecting…",
    connected: "Connected",
    reconnecting: "Reconnecting…",
    offline: "Offline",
  };

  return (
    <div className="space-y-2 text-sm leading-snug">
      <p className="text-xs font-bold tracking-wide text-foreground-muted">LIVE SCORE CONTROL</p>
      <p>
        Device: <span className="font-semibold">{device?.deviceName ?? "—"}</span>{" "}
        <button
          type="button"
          onClick={() => {
            setDevice(null);
            setStatus("setup");
          }}
          className="text-xs text-foreground-muted underline"
        >
          rename
        </button>
      </p>
      <p>
        Status:{" "}
        <span className={`font-semibold ${status === "connected" ? "text-success" : "text-danger"}`}>
          {status === "connected" ? "●" : "○"} {statusText[status]}
        </span>
        {lastHeartbeat && <span className="ml-2 text-xs text-foreground-muted">heartbeat {timeOf(lastHeartbeat)}</span>}
      </p>
      {setupError && <p className="text-danger">{setupError}</p>}
      <div>
        Last command:{" "}
        {lastCommand ? (
          <>
            <span className="font-semibold">{lastCommand.title}</span>{" "}
            <span className="text-xs text-foreground-muted">{timeOf(lastCommand.at)}</span>{" "}
            {/* A real link as a fallback: if iPadOS blocks the automatic
                open, one tap here still works. */}
            <a href={lastCommand.url} className="text-xs text-accent underline">
              open again
            </a>
          </>
        ) : (
          <span className="text-foreground-muted">none yet</span>
        )}
      </div>
      <details className="text-xs text-foreground-muted">
        <summary>Log ({log.length})</summary>
        <ul className="mt-1 max-h-64 space-y-0.5 overflow-y-auto font-mono">
          {log.map((entry, i) => (
            <li key={i}>
              {timeOf(entry.at)} {entry.text}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
