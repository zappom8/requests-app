"use client";

import { useEffect, useState } from "react";
import {
  getShortcutToken,
  listAbletonReceivers,
  registerDevice,
  removeDevice,
  type ReceiverSummary,
} from "@/actions/devices";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

// The laptop(s) whose guitar-pad helper cues Ableton scenes when you choose a
// song on the Live Queue. Every receiver listed here gets every cue.
export default function AbletonReceiverSettings() {
  const [receivers, setReceivers] = useState<ReceiverSummary[] | null>(null);
  const [link, setLink] = useState<{ deviceId: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    listAbletonReceivers()
      .then(setReceivers)
      .catch(() => {});
  }
  useEffect(refresh, []);

  function showLink(deviceId: string, token: string) {
    setCopied(false);
    setLink({ deviceId, url: `${window.location.origin}/api/live-control/next/${token}` });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await registerDevice({ deviceId: null, name: newName, role: "ableton_receiver" });
      setNewName("");
      showLink(result.deviceId, result.channelToken!);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add it");
    }
  }

  async function handleRemove(id: string, name: string) {
    if (!confirm(`Remove ${name}? Its helper will stop receiving scene cues.`)) return;
    await removeDevice(id);
    if (link?.deviceId === id) setLink(null);
    refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div>
        <h2 className="text-sm font-medium">Ableton Receiver</h2>
        <p className="text-xs text-foreground-muted">
          The laptop running the guitar-pad helper. Choosing a song on the Live Queue (F, or its forScore button)
          also selects that song&apos;s scene in Ableton.
        </p>
      </div>

      {receivers === null ? (
        <p className="text-sm text-foreground-muted">Loading…</p>
      ) : receivers.length === 0 ? (
        <p className="text-sm text-foreground-muted">None yet — add one below.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {receivers.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2">
              <span className="flex-1 text-sm">
                <span className="font-medium">{r.name}</span>
                <span className={`ml-2 text-xs ${r.online ? "text-success" : "text-foreground-muted"}`}>
                  {r.online ? "● Online" : "○ Offline"}
                </span>
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (link?.deviceId === r.id) setLink(null);
                  else showLink(r.id, await getShortcutToken(r.id));
                }}
                className="text-xs text-foreground-muted hover:text-foreground"
              >
                Helper link
              </button>
              <button
                type="button"
                onClick={() => void handleRemove(r.id, r.name)}
                className="text-xs text-foreground-muted hover:text-danger"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {link && (
        <div className="space-y-1 rounded-lg bg-background p-2 text-xs">
          <p className="break-all font-mono">{link.url}</p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(link.url).then(() => setCopied(true));
            }}
            className="rounded-md border border-border px-2 py-1 font-medium"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <span className="ml-2 text-foreground-muted">The helper&apos;s private address. Keep it private.</span>
        </div>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add a laptop, e.g. MacBook"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="shrink-0 rounded-lg border border-border px-3 text-sm font-medium disabled:opacity-40"
        >
          Add
        </button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
