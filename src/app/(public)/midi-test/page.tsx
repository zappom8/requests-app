"use client";

// Temporary hardware-testing page — not linked from anywhere in the app,
// public (no login) purely so it's reachable at a plain https:// URL that a
// minimal iOS WebView (e.g. the "Web MIDI Browser" app) will actually
// recognize as a URL rather than treat as a search query, unlike a data:
// URI or a claude.ai artifact link (both failed for that reason during
// testing). Delete this route once the MIDI Mitter / forScore feasibility
// test is done — it's scaffolding, not a real feature.

import { useEffect, useRef, useState } from "react";

type LogEntry = { time: string; text: string };

// Mirrors the Program Change "open" commands written into the
// Footdrums-MIDI-Patch-Test.4ss setlist (forScore stores them with channel
// -1, i.e. any channel), so tapping a song here should open that score.
const FORSCORE_TEST_SONGS = [
  { title: "Wish You Well", program: 50 },
  { title: "I'm Gonna Be (500 Miles)", program: 51 },
  { title: "How You Remind Me", program: 52 },
];

// Web MIDI Browser's bridge (and this is true of every WKWebView-based
// Web MIDI shim, not just this one app) works by injecting a JS polyfill
// that calls window.webkit.messageHandlers.<name>.postMessage(...) to talk
// to native code — there's no such thing on a real Web MIDI browser
// (Chrome etc.), where navigator.requestMIDIAccess is a true built-in.
// Checking for window.webkit directly tells us whether that bridge is
// even present on this exact page load, before worrying about whether any
// MIDI ports show up through it.
function getBridgeDiagnostics(): string[] {
  const w = window as unknown as { webkit?: { messageHandlers?: Record<string, unknown> } };
  const lines: string[] = [];
  lines.push(`navigator.requestMIDIAccess: ${typeof navigator.requestMIDIAccess}`);
  lines.push(`window.webkit: ${typeof w.webkit}`);
  lines.push(`window.webkit.messageHandlers: ${typeof w.webkit?.messageHandlers}`);
  if (w.webkit?.messageHandlers) {
    lines.push(`  .onready: ${typeof w.webkit.messageHandlers.onready}`);
    lines.push(`  .send: ${typeof w.webkit.messageHandlers.send}`);
    lines.push(`  .clear: ${typeof w.webkit.messageHandlers.clear}`);
  }
  return lines;
}

function describe(data: Uint8Array): string {
  const status = data[0];
  const type = status & 0xf0;
  const channel = (status & 0x0f) + 1;
  if (type === 0xc0) return `Program Change  ch ${channel}  program ${data[1]}`;
  if (type === 0x90) return `${data[2] === 0 ? "Note Off" : "Note On"}  ch ${channel}  note ${data[1]}  vel ${data[2]}`;
  if (type === 0x80) return `Note Off  ch ${channel}  note ${data[1]}`;
  if (type === 0xb0) return `Control Change  ch ${channel}  cc ${data[1]}  val ${data[2]}`;
  return "Other";
}

export default function MidiTestPage() {
  const [status, setStatus] = useState("Tap Connect to request MIDI access.");
  const [outputs, setOutputs] = useState<{ id: string; name: string }[]>([]);
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
  const [channel, setChannel] = useState(1);
  const [program, setProgram] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const midiAccessRef = useRef<MIDIAccess | null>(null);

  function addLog(text: string) {
    const time = new Date().toLocaleTimeString();
    setLog((prev) => [{ time, text }, ...prev].slice(0, 50));
  }

  function refreshFromAccess(access: MIDIAccess) {
    // Web MIDI Browser's polyfill implements outputs/inputs with a
    // hand-rolled .next()-based iterator that has no Symbol.iterator, so
    // Array.from(access.outputs.values()) silently returns [] on it even
    // when real ports exist — real browsers don't have this gap, but
    // .forEach() (which the polyfill does implement, and which is also
    // part of the real MIDIOutputMap spec) works correctly on both.
    const list: { id: string; name: string }[] = [];
    access.outputs.forEach((o) => list.push({ id: o.id, name: o.name ?? "Unnamed output" }));
    setOutputs(list);
    setStatus(`${list.length} output(s) found${list.length ? ": " + list.map((o) => o.name).join(", ") : ""}`);
    setSelectedOutputId((current) => current ?? list[0]?.id ?? null);

    access.inputs.forEach((input) => {
      input.onmidimessage = (e) => {
        if (e.data) addLog(`IN  ${input.name ?? "input"} — ${describe(e.data)}`);
      };
    });
  }

  async function connect() {
    setDiagnostics(getBridgeDiagnostics());
    if (!navigator.requestMIDIAccess) {
      setStatus("navigator.requestMIDIAccess isn't available in this browser — open this page inside Web MIDI Browser, not Safari.");
      return;
    }
    try {
      setStatus("Requesting MIDI access…");
      const access = await navigator.requestMIDIAccess({ sysex: false });
      midiAccessRef.current = access;
      access.onstatechange = () => refreshFromAccess(access);
      refreshFromAccess(access);
    } catch (e) {
      setStatus(`MIDI access failed: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }

  function refresh() {
    if (midiAccessRef.current) refreshFromAccess(midiAccessRef.current);
  }

  function sendProgramChange(programToSend = program, label?: string) {
    const access = midiAccessRef.current;
    const output = selectedOutputId ? access?.outputs.get(selectedOutputId) : null;
    if (!output) {
      addLog("No output selected");
      return;
    }
    const ch = Math.min(16, Math.max(1, channel));
    const pc = Math.min(127, Math.max(0, programToSend));
    const data = [0xc0 | (ch - 1), pc];
    output.send(data);
    addLog(`SENT → ${output.name} — Program Change  ch ${ch}  program ${pc}${label ? `  (${label})` : ""}`);
  }

  function sendTestNote() {
    const access = midiAccessRef.current;
    const output = selectedOutputId ? access?.outputs.get(selectedOutputId) : null;
    if (!output) {
      addLog("No output selected");
      return;
    }
    output.send([0x90, 60, 100]);
    addLog(`SENT → ${output.name} — Note On  middle C`);
    setTimeout(() => {
      output.send([0x80, 60, 0]);
      addLog(`SENT → ${output.name} — Note Off  middle C`);
    }, 250);
  }

  // Clean up message handlers on unmount.
  useEffect(() => {
    return () => {
      midiAccessRef.current?.inputs.forEach((input) => {
        input.onmidimessage = null;
      });
    };
  }, []);

  return (
    <div className="min-h-screen px-4 py-8 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">MIDI Test</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Temporary tool for testing a Web MIDI connection to MIDI Mitter / forScore.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-medium mb-2">Bridge diagnostics</h2>
        <p className="text-xs text-foreground-muted mb-2">
          Whether Web MIDI Browser&apos;s native bridge is actually present on this page (appears after you tap
          Connect below). In Safari every line here would read &quot;undefined&quot;.
        </p>
        {diagnostics.length === 0 ? (
          <p className="text-xs text-foreground-muted">Tap Connect to check.</p>
        ) : (
          <ul className="text-xs font-mono space-y-0.5">
            {diagnostics.map((line, i) => (
              <li key={i} className={line.includes("undefined") ? "text-danger" : "text-success"}>
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <p className="text-sm">{status}</p>
        <div className="flex gap-2">
          <button
            onClick={connect}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
          >
            Connect
          </button>
          <button
            onClick={refresh}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-accent"
          >
            Refresh ports
          </button>
        </div>
      </div>

      {outputs.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-2">
          <h2 className="text-sm font-medium">Output</h2>
          {outputs.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="output"
                checked={selectedOutputId === o.id}
                onChange={() => setSelectedOutputId(o.id)}
                className="h-4 w-4 accent-accent"
              />
              {o.name}
            </label>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <h2 className="text-sm font-medium">forScore test set list</h2>
        <p className="text-xs text-foreground-muted">
          Tap a song to open its &quot;(MIDI Patch Test)&quot; score in forScore.
        </p>
        <div className="space-y-2">
          {FORSCORE_TEST_SONGS.map((song) => (
            <button
              key={song.program}
              onClick={() => sendProgramChange(song.program, song.title)}
              className="flex w-full items-center justify-between rounded-lg border border-border px-4 py-3 text-left text-sm font-medium hover:border-accent"
            >
              <span>{song.title}</span>
              <span className="text-xs font-mono text-foreground-muted">PC {song.program}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <h2 className="text-sm font-medium">Send Program Change</h2>
        <p className="text-xs text-foreground-muted">
          What forScore listens for to jump to a score. Values here are raw 0–127; if forScore&apos;s own picker
          shows 1–128, send one less than what it displays.
        </p>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-foreground-muted block mb-1">Channel (1–16)</label>
            <input
              type="number"
              min={1}
              max={16}
              value={channel}
              onChange={(e) => setChannel(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-foreground-muted block mb-1">Program (0–127)</label>
            <input
              type="number"
              min={0}
              max={127}
              value={program}
              onChange={(e) => setProgram(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>
        <button
          onClick={() => sendProgramChange()}
          className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
        >
          Send Program Change
        </button>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <h2 className="text-sm font-medium">Send test note</h2>
        <button
          onClick={sendTestNote}
          className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-accent"
        >
          Send Note On/Off (Middle C)
        </button>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-medium mb-2">Log</h2>
        {log.length === 0 ? (
          <p className="text-xs text-foreground-muted">Nothing sent or received yet.</p>
        ) : (
          <ul className="space-y-1 text-xs font-mono">
            {log.map((entry, i) => (
              <li key={i} className="text-foreground-muted">
                <span className="text-foreground">{entry.time}</span> {entry.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
