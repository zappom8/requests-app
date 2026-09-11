"use client";

import { useState } from "react";
import {
  createSongPairingGroup,
  addSongToGroup,
  removeSongFromGroup,
  deleteSongPairingGroup,
  type SongRef,
} from "@/actions/songPairings";

type SongOption = { name: string; artist: string };
type GroupMember = { id: string; songName: string; artistName: string };
type Group = { groupId: string; members: GroupMember[] };

function NewGroupForm({ songs }: { songs: SongOption[] }) {
  const [building, setBuilding] = useState<SongRef[]>([]);
  const [picked, setPicked] = useState("");

  function addPicked() {
    if (picked === "") return;
    const song = songs[Number(picked)];
    const ref = { songName: song.name, artistName: song.artist };
    if (!building.some((s) => s.songName === ref.songName && s.artistName === ref.artistName)) {
      setBuilding([...building, ref]);
    }
    setPicked("");
  }

  return (
    <form
      action={async (formData) => {
        formData.set("songs", JSON.stringify(building));
        await createSongPairingGroup(formData);
        setBuilding([]);
      }}
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
    >
      <p className="text-sm font-medium">New pairing group</p>

      <div className="flex flex-wrap gap-2">
        {building.map((s) => (
          <span
            key={`${s.songName} ${s.artistName}`}
            className="flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1 text-xs font-medium"
          >
            {s.songName} — {s.artistName}
            <button
              type="button"
              onClick={() => setBuilding(building.filter((b) => b !== s))}
              className="text-foreground-muted hover:text-danger"
              aria-label={`Remove ${s.songName}`}
            >
              ×
            </button>
          </span>
        ))}
        {building.length === 0 && <p className="text-xs text-foreground-muted">Add at least 2 songs below.</p>}
      </div>

      <div className="flex gap-2">
        <select
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="" disabled>
            Choose a song…
          </option>
          {songs.map((s, i) => (
            <option key={i} value={i}>
              {s.name} — {s.artist}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addPicked}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-accent"
        >
          Add to group
        </button>
      </div>

      <button
        type="submit"
        disabled={building.length < 2}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
      >
        Create Group
      </button>
    </form>
  );
}

function GroupCard({ group, songs }: { group: Group; songs: SongOption[] }) {
  const [picked, setPicked] = useState("");
  const availableSongs = songs.filter(
    (s) => !group.members.some((m) => m.songName === s.name && m.artistName === s.artist)
  );
  const pickedSong = picked !== "" ? availableSongs[Number(picked)] : undefined;

  return (
    <li className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {group.members.map((m) => (
          <span key={m.id} className="flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1 text-xs font-medium">
            {m.songName} — {m.artistName}
            <form
              action={async (formData) => {
                await removeSongFromGroup(formData);
              }}
            >
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="groupId" value={group.groupId} />
              <button type="submit" className="text-foreground-muted hover:text-danger" aria-label={`Remove ${m.songName}`}>
                ×
              </button>
            </form>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <select
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-accent"
        >
          <option value="" disabled>
            Add another song…
          </option>
          {availableSongs.map((s, i) => (
            <option key={i} value={i}>
              {s.name} — {s.artist}
            </option>
          ))}
        </select>
        <form
          action={async (formData) => {
            await addSongToGroup(formData);
            setPicked("");
          }}
        >
          <input type="hidden" name="groupId" value={group.groupId} />
          <input type="hidden" name="songName" value={pickedSong?.name ?? ""} />
          <input type="hidden" name="artistName" value={pickedSong?.artist ?? ""} />
          <button
            type="submit"
            disabled={picked === ""}
            className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:border-accent disabled:opacity-50"
          >
            Add
          </button>
        </form>
        <form action={deleteSongPairingGroup}>
          <input type="hidden" name="groupId" value={group.groupId} />
          <button type="submit" className="text-xs font-medium text-danger hover:underline whitespace-nowrap">
            Delete group
          </button>
        </form>
      </div>
    </li>
  );
}

export default function SongPairingsManager({ songs, groups }: { songs: SongOption[]; groups: Group[] }) {
  return (
    <div className="space-y-4">
      <NewGroupForm songs={songs} />

      {groups.length === 0 ? (
        <p className="text-sm text-foreground-muted">No pairing groups yet — create one above.</p>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <GroupCard key={g.groupId} group={g} songs={songs} />
          ))}
        </ul>
      )}
    </div>
  );
}
