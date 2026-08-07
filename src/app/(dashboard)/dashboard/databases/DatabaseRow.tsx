"use client";

import { useState } from "react";
import Link from "next/link";
import {
  setActiveDatabase,
  renameSongDatabase,
  duplicateSongDatabase,
  deleteSongDatabase,
} from "@/actions/databases";

export default function DatabaseRow({
  id,
  name,
  songCount,
  isActive,
  canDelete,
}: {
  id: string;
  name: string;
  songCount: number;
  isActive: boolean;
  canDelete: boolean;
}) {
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAction(fn: (formData: FormData) => Promise<void>, formData: FormData) {
    setError(null);
    try {
      await fn(formData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <li className="rounded-lg border border-border bg-surface px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        {renaming ? (
          <form
            className="flex-1 flex gap-2"
            action={async (formData) => {
              formData.set("songDatabaseId", id);
              await runAction(renameSongDatabase, formData);
              setRenaming(false);
            }}
          >
            <input
              type="text"
              name="name"
              defaultValue={name}
              autoFocus
              className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
            />
            <button type="submit" className="text-xs font-medium text-accent-hover hover:underline">
              Save
            </button>
            <button
              type="button"
              onClick={() => setRenaming(false)}
              className="text-xs font-medium text-foreground-muted hover:text-foreground"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div>
            <Link href={`/dashboard/databases/${id}`} className="font-medium hover:underline">
              {name}
            </Link>
            <p className="text-xs text-foreground-muted">{songCount} songs</p>
          </div>
        )}

        {isActive ? (
          <span className="text-xs font-medium text-accent-hover rounded-full border border-accent px-3 py-1 shrink-0">
            Active
          </span>
        ) : (
          <form action={(fd) => runAction(setActiveDatabase, fd)} className="shrink-0">
            <input type="hidden" name="songDatabaseId" value={id} />
            <button
              type="submit"
              className="text-xs font-medium rounded-full border border-border px-3 py-1 hover:border-accent hover:text-accent-hover"
            >
              Set active
            </button>
          </form>
        )}
      </div>

      <div className="flex gap-3 text-xs text-foreground-muted">
        {!renaming && (
          <button onClick={() => setRenaming(true)} className="hover:text-foreground">
            Rename
          </button>
        )}
        <form action={(fd) => runAction(duplicateSongDatabase, fd)}>
          <input type="hidden" name="songDatabaseId" value={id} />
          <button type="submit" className="hover:text-foreground">
            Duplicate
          </button>
        </form>
        {canDelete && (
          <form action={(fd) => runAction(deleteSongDatabase, fd)}>
            <input type="hidden" name="songDatabaseId" value={id} />
            <button type="submit" className="text-danger hover:underline">
              Delete
            </button>
          </form>
        )}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
    </li>
  );
}
