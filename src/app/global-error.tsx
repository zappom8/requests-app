"use client";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en" className="dark">
      <body
        style={{ background: "#0a0a0f", color: "#f5f5f7" }}
        className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center antialiased"
      >
        <p className="text-lg font-semibold">Something went wrong.</p>
        <button
          onClick={retry}
          style={{ background: "#7c3aed", color: "#fff" }}
          className="rounded-lg px-4 py-3 text-sm font-medium"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
