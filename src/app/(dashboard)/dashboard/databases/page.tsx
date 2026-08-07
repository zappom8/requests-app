import { prisma } from "@/lib/prisma";
import { createSongDatabase } from "@/actions/databases";
import DatabaseRow from "./DatabaseRow";

// Admin-facing, always needs current DB state — never statically cached.
export const dynamic = "force-dynamic";

export default async function DatabasesPage() {
  const [databases, settings] = await Promise.all([
    prisma.songDatabase.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { songs: true, requests: true } } },
    }),
    prisma.settings.findUnique({ where: { id: 1 } }),
  ]);

  const activeId = settings?.activeSongDatabaseId ?? null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold mb-1">Song Databases</h1>
        <p className="text-sm text-foreground-muted">
          Whichever database is active is what audiences see on the public request page.
        </p>
      </div>

      <ul className="space-y-2">
        {databases.map((db) => (
          <DatabaseRow
            key={db.id}
            id={db.id}
            name={db.name}
            songCount={db._count.songs}
            isActive={db.id === activeId}
            canDelete={db.id !== activeId && db._count.requests === 0}
          />
        ))}
      </ul>

      <form action={createSongDatabase} className="flex gap-2">
        <input
          type="text"
          name="name"
          placeholder="New database name (e.g. Wedding)"
          required
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
        >
          Create
        </button>
      </form>
    </div>
  );
}
