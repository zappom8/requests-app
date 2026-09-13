"use client";

import { useState } from "react";
import { updateSong, deleteSong } from "@/actions/songs";

export default function SongRow({
  id,
  songDatabaseId,
  name,
  artist,
  decade,
}: {
  id: string;
  songDatabaseId: string;
  name: string;
  artist: string;
  decade: string | null;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="px-4 py-3">
        <form
          action={async (formData) => {
            await updateSong(formData);
            setEditing(false);
          }}
          className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_120px_auto_auto] gap-2"
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="songDatabaseId" value={songDatabaseId} />
          <input
            type="text"
            name="name"
            defaultValue={name}
            required
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            type="text"
            name="artist"
            defaultValue={artist}
            required
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            type="text"
            name="decade"
            defaultValue={decade ?? ""}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-foreground hover:bg-accent-hover"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:border-accent"
          >
            Cancel
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between px-4 py-3">
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-xs text-foreground-muted">
          {artist}
          {decade ? ` · ${decade}` : ""}
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={() => setEditing(true)} className="text-xs font-medium hover:underline">
          Edit
        </button>
        <form action={deleteSong}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="songDatabaseId" value={songDatabaseId} />
          <button type="submit" className="text-xs font-medium text-danger hover:underline">
            Delete
          </button>
        </form>
      </div>
    </li>
  );
}
