"use client";

import { useEffect } from "react";

export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="text-lg font-semibold">Something went wrong.</p>
      <p className="text-sm text-foreground-muted max-w-sm">{error.message || "Please try again."}</p>
      <button
        onClick={retry}
        className="rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
      >
        Try again
      </button>
    </div>
  );
}
