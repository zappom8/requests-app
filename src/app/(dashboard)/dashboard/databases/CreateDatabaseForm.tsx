"use client";

import { useRef, useState } from "react";
import { createSongDatabase } from "@/actions/databases";

export default function CreateDatabaseForm() {
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <form
        ref={formRef}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
        action={async (formData) => {
          setError(null);
          const result = await createSongDatabase(formData);
          if (!result.success) setError(result.error);
          else formRef.current?.reset();
        }}
      >
        <input
          type="text"
          name="name"
          placeholder="New database name (e.g. Wedding)"
          required
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          className="flex-1 text-sm text-foreground-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-foreground"
        />
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
        >
          Create
        </button>
      </form>
      {error && <p className="text-xs text-danger">{error}</p>}
      <p className="text-xs text-foreground-muted">
        Optionally upload a CSV (<code>Song Name,Artist,Decade</code>) to populate it right away — otherwise it
        starts empty.
      </p>
    </div>
  );
}
