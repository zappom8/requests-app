"use client";

import { useRef, useState } from "react";
import { createSongInDatabases } from "@/actions/songs";

type Database = { id: string; name: string };

export default function AddSongToDatabasesForm({ databases }: { databases: Database[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === databases.length ? new Set() : new Set(databases.map((d) => d.id))));
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div>
        <h2 className="text-sm font-medium">Add a song to multiple databases</h2>
        <p className="text-xs text-foreground-muted">
          Enter it once, pick which databases it belongs on — no need to repeat it in each one.
        </p>
      </div>

      <form
        ref={formRef}
        action={async (formData) => {
          setError(null);
          try {
            await createSongInDatabases(formData);
            formRef.current?.reset();
            setSelected(new Set());
          } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
          }
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_120px] gap-2">
          <input
            type="text"
            name="name"
            placeholder="Song name"
            required
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            type="text"
            name="artist"
            placeholder="Artist"
            required
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            type="text"
            name="decade"
            placeholder="Decade"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        {databases.length === 0 ? (
          <p className="text-sm text-foreground-muted">Create a database below first.</p>
        ) : (
          <div className="space-y-1.5">
            <button type="button" onClick={toggleAll} className="text-xs font-medium text-accent-hover hover:underline">
              {selected.size === databases.length ? "Deselect all" : "Select all"}
            </button>
            <div className="flex flex-wrap gap-2">
              {databases.map((db) => (
                <label
                  key={db.id}
                  className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-accent/10"
                >
                  <input
                    type="checkbox"
                    name="songDatabaseIds"
                    value={db.id}
                    checked={selected.has(db.id)}
                    onChange={() => toggle(db.id)}
                    className="h-4 w-4 accent-accent"
                  />
                  {db.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}

        <button
          type="submit"
          disabled={databases.length === 0 || selected.size === 0}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
        >
          Add to {selected.size > 0 ? `${selected.size} ` : ""}database{selected.size === 1 ? "" : "s"}
        </button>
      </form>
    </div>
  );
}
