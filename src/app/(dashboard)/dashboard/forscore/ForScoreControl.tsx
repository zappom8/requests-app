"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveControl } from "@/lib/liveControl/useLiveControl";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

export function LiveControlNotice({ notice }: { notice: ReturnType<typeof useLiveControl>["notice"] }) {
  if (!notice) return null;
  const color = notice.tone === "ok" ? "text-success" : notice.tone === "error" ? "text-danger" : "text-foreground-muted";
  return <p className={`text-sm font-medium ${color}`}>{notice.text}</p>;
}

export default function ForScoreControl({ linkedTitles }: { linkedTitles: string[] }) {
  const control = useLiveControl();
  const [testTitle, setTestTitle] = useState("");
  const [testSetlist, setTestSetlist] = useState("");

  return (
    <div className="space-y-6">
      <p className="text-sm">
        {!control.loaded ? (
          <span className="text-foreground-muted">Loading…</span>
        ) : control.selected ? (
          <>
            Sending to <span className="font-medium">{control.selected.name}</span>{" "}
            <span className={`text-xs ${control.selected.online ? "text-success" : "text-foreground-muted"}`}>
              {control.selected.online ? "● Online" : "○ Offline"}
            </span>
          </>
        ) : (
          <span className="text-danger">No forScore receiver chosen.</span>
        )}{" "}
        <Link href="/dashboard/settings" className="text-xs text-accent underline">
          change in Settings
        </Link>
      </p>

      <section className="space-y-2 rounded-xl border border-accent/50 p-4">
        <h2 className="font-semibold tracking-wide">TEST FORSCORE CONNECTION</h2>
        <p className="text-xs text-foreground-muted">
          Type the exact title of a score that&apos;s in forScore on the receiver (e.g. a Musicnotes score) and send it.
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
            Open on {control.selected?.name ?? "receiver"}
          </button>
        </form>
        <LiveControlNotice notice={control.notice} />
      </section>
    </div>
  );
}
