"use client";

import { useState } from "react";
import { getShortcutToken, registerDevice, removeDevice } from "@/actions/devices";
import { useLiveControl } from "@/lib/liveControl/useLiveControl";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

// The address a receiver's Apple Shortcut polls — see src/app/api/live-control/next.
function ShortcutLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1 rounded-lg bg-background p-2 text-xs">
      <p className="break-all font-mono">{url}</p>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(url).then(() => setCopied(true));
        }}
        className="rounded-md border border-border px-2 py-1 font-medium"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <span className="ml-2 text-foreground-muted">Paste into the Shortcut&apos;s Get Contents of URL. Keep it private.</span>
    </div>
  );
}

// Which device opens your scores when you press forScore on the Live Queue
// (from the laptop, phone, anywhere) — one choice for the whole account.
export default function ForScoreReceiverSettings() {
  const control = useLiveControl();
  const [shortcutLink, setShortcutLink] = useState<{ deviceId: string; url: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function showShortcutLink(deviceId: string, token: string) {
    setShortcutLink({ deviceId, url: `${window.location.origin}/api/live-control/next/${token}` });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await registerDevice({ deviceId: null, name: newName, role: "forscore_receiver" });
      setNewName("");
      await control.selectReceiver(result.deviceId);
      showShortcutLink(result.deviceId, result.channelToken!);
      void control.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add it");
    }
  }

  async function handleRemove(id: string, name: string) {
    if (!confirm(`Remove ${name}? Its Shortcut link will stop working.`)) return;
    await removeDevice(id);
    if (control.selected?.id === id) await control.selectReceiver(null);
    if (shortcutLink?.deviceId === id) setShortcutLink(null);
    void control.refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div>
        <h2 className="text-sm font-medium">forScore Receiver</h2>
        <p className="text-xs text-foreground-muted">
          The device that opens your scores when you press forScore on the Live Queue — an iPad or iPhone running
          the forScore Receiver shortcut. Applies to every device you use the dashboard on.
        </p>
      </div>

      {!control.loaded ? (
        <p className="text-sm text-foreground-muted">Loading…</p>
      ) : control.receivers.length === 0 ? (
        <p className="text-sm text-foreground-muted">None yet — add one below.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {control.receivers.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2">
              <label className="flex flex-1 items-center gap-3">
                <input
                  type="radio"
                  name="forscore-receiver"
                  checked={control.selected?.id === r.id}
                  onChange={() => void control.selectReceiver(r.id)}
                  className="accent-accent"
                />
                <span className="flex-1 text-sm">
                  <span className="font-medium">{r.name}</span>
                  <span className={`ml-2 text-xs ${r.online ? "text-success" : "text-foreground-muted"}`}>
                    {r.online ? "● Online" : "○ Offline"}
                  </span>
                </span>
              </label>
              <button
                type="button"
                onClick={async () => {
                  if (shortcutLink?.deviceId === r.id) setShortcutLink(null);
                  else showShortcutLink(r.id, await getShortcutToken(r.id));
                }}
                className="text-xs text-foreground-muted hover:text-foreground"
              >
                Shortcut link
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

      {shortcutLink && <ShortcutLink url={shortcutLink.url} />}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add a device, e.g. iPhone"
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
