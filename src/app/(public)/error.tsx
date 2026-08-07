"use client";

import { useEffect } from "react";

export default function PublicError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
      <p className="text-lg font-semibold">Something went wrong.</p>
      <p className="text-sm text-foreground-muted">Please try again.</p>
      <button
        onClick={retry}
        className="rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
      >
        Try again
      </button>
    </div>
  );
}
