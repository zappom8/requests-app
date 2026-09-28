"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { registerDevice, removeDevice } from "@/actions/devices";
import {
  getLocalDeviceSnapshot,
  setLocalDevice,
  subscribeLocalDevice,
  type LocalDevice,
} from "@/lib/liveControl/localDevice";
import { useLiveControl } from "@/lib/liveControl/useLiveControl";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

export function LiveControlNotice({ notice }: { notice: ReturnType<typeof useLiveControl>["notice"] }) {
  if (!notice) return null;
  const color = notice.tone === "ok" ? "text-success" : notice.tone === "error" ? "text-danger" : "text-foreground-muted";
  return <p className={`text-sm font-medium ${color}`}>{notice.text}</p>;
}

// Keyed on the stored device, so the name input starts from it once
// localStorage has been read on the client.
function ThisDevice({ localDevice, onSaved }: { localDevice: LocalDevice | null; onSaved: () => void }) {
  const [deviceName, setDeviceName] = useState(localDevice?.deviceName ?? "");
  const [deviceMessage, setDeviceMessage] = useState<string | null>(null);

  async function saveThisDevice(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await registerDevice({
        deviceId: localDevice?.deviceId ?? null,
        name: deviceName,
        role: localDevice?.deviceRole === "forscore_receiver" ? "forscore_receiver" : "controller",
      });
      const next = { deviceId: result.deviceId, deviceName: result.deviceName, deviceRole: result.deviceRole };
      setLocalDevice(next);
      setDeviceMessage("Saved");
      onSaved();
    } catch (err) {
      setDeviceMessage(err instanceof Error ? err.message : "Couldn't save");
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="font-semibold">This device</h2>
      <form onSubmit={saveThisDevice} className="flex gap-2">
        <input
          type="text"
          value={deviceName}
          onChange={(e) => {
            setDeviceName(e.target.value);
            setDeviceMessage(null);
          }}
          placeholder="e.g. Mitch iPhone"
          className={inputClass}
        />
        <button type="submit" className="shrink-0 rounded-lg border border-border px-3 text-sm font-medium">
          Save
        </button>
      </form>
      <p className="text-xs text-foreground-muted">
        {localDevice
          ? `Role: ${localDevice.deviceRole === "forscore_receiver" ? "forScore receiver" : "controller"}`
          : "Not named yet — optional for a controller."}
        {deviceMessage && <span className="ml-2">{deviceMessage}</span>}
      </p>
      <p className="text-xs text-foreground-muted">
        On the iPad, open{" "}
        <Link href="/dashboard/forscore-receiver" className="text-accent underline">
          /dashboard/forscore-receiver
        </Link>{" "}
        to make it a receiver.
      </p>
    </section>
  );
}

export default function ForScoreControl({ linkedTitles }: { linkedTitles: string[] }) {
  const control = useLiveControl();
  const localDeviceRaw = useSyncExternalStore(subscribeLocalDevice, getLocalDeviceSnapshot, () => null);
  const localDevice = localDeviceRaw ? (JSON.parse(localDeviceRaw) as LocalDevice) : null;
  const [testTitle, setTestTitle] = useState("");
  const [testSetlist, setTestSetlist] = useState("");

  async function handleRemove(id: string, name: string) {
    if (!confirm(`Remove ${name}? It can be set up again from its receiver page.`)) return;
    await removeDevice(id);
    if (control.selected?.id === id) control.selectReceiver(null);
    void control.refresh();
  }

  return (
    <div className="space-y-6">
      <ThisDevice key={localDeviceRaw ?? "none"} localDevice={localDevice} onSaved={() => void control.refresh()} />

      <section className="space-y-2">
        <h2 className="font-semibold">Send to</h2>
        {!control.loaded ? (
          <p className="text-sm text-foreground-muted">Loading…</p>
        ) : control.receivers.length === 0 ? (
          <p className="text-sm text-danger">No forScore receiver is set up yet. Open the receiver page on the iPad.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {control.receivers.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                <label className="flex flex-1 items-center gap-3">
                  <input
                    type="radio"
                    name="receiver"
                    checked={control.selected?.id === r.id}
                    onChange={() => control.selectReceiver(r.id)}
                    className="accent-accent"
                  />
                  <span className="flex-1">
                    <span className="font-medium">{r.name}</span>
                    <span className={`ml-2 text-xs ${r.online ? "text-success" : "text-foreground-muted"}`}>
                      {r.online ? "● Online" : "○ Offline"}
                    </span>
                  </span>
                </label>
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
      </section>

      <section className="space-y-2 rounded-xl border border-accent/50 p-4">
        <h2 className="font-semibold tracking-wide">TEST FORSCORE CONNECTION</h2>
        <p className="text-xs text-foreground-muted">
          Type the exact title of a score that&apos;s in forScore on the iPad (e.g. a Musicnotes score) and send it.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void control.openScore({ title: testTitle, setlist: testSetlist || null });
          }}
          className="space-y-2"
        >
          <input
            type="text"
            value={testTitle}
            onChange={(e) => setTestTitle(e.target.value)}
            list="forscore-linked-titles"
            placeholder="forScore score title, e.g. Piano Man"
            autoCapitalize="off"
            autoCorrect="off"
            className={inputClass}
          />
          <datalist id="forscore-linked-titles">
            {linkedTitles.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <input
            type="text"
            value={testSetlist}
            onChange={(e) => setTestSetlist(e.target.value)}
            placeholder="Setlist (optional)"
            autoCapitalize="off"
            autoCorrect="off"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={!testTitle.trim()}
            className="h-12 w-full rounded-xl bg-accent font-bold text-accent-foreground disabled:opacity-40"
          >
            Open on {control.selected?.name ?? "iPad"}
          </button>
        </form>
        <LiveControlNotice notice={control.notice} />
      </section>
    </div>
  );
}
