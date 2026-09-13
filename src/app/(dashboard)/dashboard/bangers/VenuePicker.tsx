"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createVenue, renameVenue, deleteVenue, setCurrentVenue } from "@/actions/venues";

type Venue = { id: string; name: string };

export default function VenuePicker({
  venues,
  selectedVenueId,
}: {
  venues: Venue[];
  selectedVenueId: string | null;
}) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const selected = venues.find((v) => v.id === selectedVenueId) ?? null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedVenueId ?? ""}
          onChange={(e) => router.push(`/dashboard/bangers?venueId=${e.target.value}`)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        >
          {venues.length === 0 && <option value="">No venues yet</option>}
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>

        {selected && !renaming && (
          <>
            <button
              type="button"
              onClick={() => setRenaming(true)}
              className="text-xs font-medium hover:underline"
            >
              Rename
            </button>
            <form
              action={async (formData) => {
                await deleteVenue(formData);
                router.push("/dashboard/bangers");
              }}
            >
              <input type="hidden" name="id" value={selected.id} />
              <button type="submit" className="text-xs font-medium text-danger hover:underline">
                Delete venue
              </button>
            </form>
            <form action={setCurrentVenue}>
              <input type="hidden" name="venueId" value={selected.id} />
              <button
                type="submit"
                className="text-xs font-medium rounded-full border border-border px-3 py-1 hover:border-accent hover:text-accent-hover"
              >
                Use on Live Queue
              </button>
            </form>
          </>
        )}
      </div>

      {selected && renaming && (
        <form
          className="flex gap-2"
          action={async (formData) => {
            await renameVenue(formData);
            setRenaming(false);
          }}
        >
          <input type="hidden" name="id" value={selected.id} />
          <input
            type="text"
            name="name"
            defaultValue={selected.name}
            autoFocus
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-foreground hover:bg-accent-hover">
            Save
          </button>
          <button type="button" onClick={() => setRenaming(false)} className="text-xs font-medium hover:underline">
            Cancel
          </button>
        </form>
      )}

      <form
        className="flex gap-2"
        action={async (formData) => {
          await createVenue(formData);
        }}
      >
        <input
          type="text"
          name="name"
          placeholder="New venue name (e.g. The Grand)"
          required
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button type="submit" className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-accent">
          Add venue
        </button>
      </form>
    </div>
  );
}
