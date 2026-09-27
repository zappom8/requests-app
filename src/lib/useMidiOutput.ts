"use client";

import { useEffect, useRef, useState } from "react";

// Sends MIDI from the browser to forScore on the iPad. Works in desktop
// Chrome (built-in Web MIDI) and on iPhone inside the "Web MIDI Browser"
// app (a WKWebView that polyfills navigator.requestMIDIAccess); Safari has
// no Web MIDI at all, so `supported` is false there.
//
// Two quirks of that iOS polyfill shape this code (both found on the
// /midi-test page): its outputs map has no Symbol.iterator, so
// Array.from(outputs.values()) silently returns [] — only .forEach() works —
// and the connection can drop while the app is backgrounded, so we
// reconnect on returning to the foreground and again before any send that
// finds its output gone.

const STORAGE_KEY = "midi-output-name";

export type MidiOutputInfo = { id: string; name: string };

function readStoredName(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeName(name: string) {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // private mode etc. — just won't be remembered
  }
}

// Desktop Chrome shows a permission prompt on requestMIDIAccess, so only
// connect on page load if it's already been granted (otherwise wait for the
// first send). The iOS polyfill never prompts, and its WebView typically
// can't answer a "midi" permission query at all — treat that as fine.
async function mayConnectWithoutPrompt(): Promise<boolean> {
  try {
    const status = await navigator.permissions.query({ name: "midi" as PermissionName });
    return status.state === "granted";
  } catch {
    return true;
  }
}

export function useMidiOutput() {
  const [supported, setSupported] = useState(false);
  const [outputs, setOutputs] = useState<MidiOutputInfo[]>([]);
  const [selectedId, setSelectedIdState] = useState<string | null>(null);
  const accessRef = useRef<MIDIAccess | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  function setSelectedId(id: string | null) {
    selectedIdRef.current = id;
    setSelectedIdState(id);
  }

  function refresh(access: MIDIAccess) {
    const list: MidiOutputInfo[] = [];
    access.outputs.forEach((o) => list.push({ id: o.id, name: o.name ?? "Unnamed output" }));
    setOutputs(list);
    const current = selectedIdRef.current;
    if (current && list.some((o) => o.id === current)) return;
    const stored = readStoredName();
    setSelectedId(list.find((o) => o.name === stored)?.id ?? list[0]?.id ?? null);
  }

  async function connect(): Promise<MIDIAccess | null> {
    if (!navigator.requestMIDIAccess) return null;
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      accessRef.current = access;
      access.onstatechange = () => refresh(access);
      refresh(access);
      return access;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection only possible client-side
    setSupported(true);
    void mayConnectWithoutPrompt().then((ok) => {
      if (ok) void connect();
    });
    function onVisible() {
      if (document.visibilityState === "visible" && accessRef.current) void connect();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- connect only reads refs/setters
  }, []);

  function selectOutput(id: string) {
    setSelectedId(id);
    const name = outputs.find((o) => o.id === id)?.name;
    if (name) storeName(name);
  }

  // Resolves to the output name it was sent to, or null if there was no
  // usable output even after reconnecting.
  async function send(data: number[]): Promise<string | null> {
    const id = selectedIdRef.current;
    let output = id ? accessRef.current?.outputs.get(id) : undefined;
    if (!output || output.state === "disconnected") {
      const access = await connect();
      const newId = selectedIdRef.current;
      output = newId ? access?.outputs.get(newId) : undefined;
    }
    if (!output) return null;
    output.send(data);
    return output.name ?? "MIDI output";
  }

  return { supported, outputs, selectedId, selectOutput, send };
}
