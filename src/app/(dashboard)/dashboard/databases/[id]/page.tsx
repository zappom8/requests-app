import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSong } from "@/actions/songs";
import SongList from "./SongList";
import CsvImportForm from "./CsvImportForm";

export default async function SongManagerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const database = await prisma.songDatabase.findUnique({
    where: { id },
    include: { songs: { orderBy: { name: "asc" } } },
  });

  if (!database) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/databases" className="text-sm text-foreground-muted hover:text-foreground">
          ← Song Databases
        </Link>
        <h1 className="text-xl font-semibold mt-1">{database.name}</h1>
        <p className="text-sm text-foreground-muted">{database.songs.length} songs</p>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border bg-surface p-4">
        <CsvImportForm songDatabaseId={database.id} />
        <a
          href={`/api/dashboard/databases/${database.id}/export`}
          className="text-sm font-medium text-accent-hover hover:underline whitespace-nowrap"
        >
          Download CSV
        </a>
      </div>

      <form action={createSong} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_120px_auto] gap-2">
        <input type="hidden" name="songDatabaseId" value={database.id} />
        <input
          type="text"
          name="name"
          placeholder="Song name"
          required
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          type="text"
          name="artist"
          placeholder="Artist"
          required
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          type="text"
          name="decade"
          placeholder="Decade"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
        >
          Add song
        </button>
      </form>

      <SongList songDatabaseId={database.id} songs={database.songs} />
    </div>
  );
}
