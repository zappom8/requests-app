"use client";

import { useRef, useState } from "react";
import { importSongsCsv } from "@/actions/songs";

export default function CsvImportForm({ songDatabaseId }: { songDatabaseId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function handleSubmit(formData: FormData) {
    setImporting(true);
    setError(null);
    try {
      await importSongsCsv(formData);
      formRef.current?.reset();
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        ref={formRef}
        action={handleSubmit}
        onSubmit={(e) => {
          if (!confirming) {
            e.preventDefault();
            setConfirming(true);
          }
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="songDatabaseId" value={songDatabaseId} />
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          onChange={() => setConfirming(false)}
          className="text-sm text-foreground-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-foreground"
        />
        <button
          type="submit"
          disabled={importing}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-accent disabled:opacity-50"
        >
          {importing ? "Importing…" : confirming ? "Confirm: replace all songs?" : "Import CSV"}
        </button>
      </form>
      <p className="text-xs text-foreground-muted">
        Format: <code>Song Name,Artist,Decade</code>. Importing replaces this database&apos;s entire song list.
      </p>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
