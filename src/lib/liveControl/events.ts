// The live-control event format, shared by the server (src/actions/devices.ts)
// and every receiver. Kept independent of Safari/React so a PWA or a native
// iPad app can receive exactly the same JSON later.
//
// "forscore.open_score" and "ableton.cue_scene" exist today. Future commands (forscore page
// turns, keyboard/guitar patches, TouchDesigner scenes, MIDI/OSC, ...) are
// added by extending CommandPayloads and validatePayload below — nothing
// about the transport, device registry or command log needs to change.

// ableton_receiver: the laptop's guitar-pad helper (~/LOOPER), which polls
// /api/live-control/next and cues the song's scene in Ableton Live.
export const DEVICE_ROLES = ["controller", "forscore_receiver", "ableton_receiver"] as const;
export type DeviceRole = (typeof DEVICE_ROLES)[number];

export type CommandPayloads = {
  "forscore.open_score": {
    songId: string | null;
    songName: string | null;
    artistName: string | null;
    title: string;
    filename: string | null;
    setlist: string | null;
  };
  // Select (or select and launch) the Ableton scene named "Song — Artist".
  "ableton.cue_scene": {
    action: "select" | "launch";
    songName: string;
    artistName: string;
  };
};
export type CommandType = keyof CommandPayloads;

export type LiveCommandEvent<T extends CommandType = CommandType> = {
  eventId: string;
  type: T;
  performerId: string;
  targetDeviceId: string;
  sourceDeviceId: string | null;
  payload: CommandPayloads[T];
  sentAt: string; // ISO timestamp, server clock
};

// The Realtime Broadcast event name every command is sent under.
export const LIVE_COMMAND_EVENT = "live-command";

export function deviceChannelName(channelToken: string) {
  return `device:${channelToken}`;
}

function optionalString(value: unknown, max = 300): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

// Throws on anything malformed; returns a clean payload otherwise.
export function validatePayload<T extends CommandType>(type: T, raw: unknown): CommandPayloads[T] {
  const input = (raw ?? {}) as Record<string, unknown>;
  switch (type) {
    case "forscore.open_score": {
      const title = optionalString(input.title);
      const filename = optionalString(input.filename);
      if (!title && !filename) throw new Error("A forScore title is required.");
      return {
        songId: optionalString(input.songId, 100),
        songName: optionalString(input.songName),
        artistName: optionalString(input.artistName),
        title: title ?? filename!,
        filename,
        setlist: optionalString(input.setlist),
      } as CommandPayloads[T];
    }
    case "ableton.cue_scene": {
      const songName = optionalString(input.songName);
      const artistName = optionalString(input.artistName);
      if (!songName || !artistName) throw new Error("A song and artist are required.");
      return {
        action: input.action === "launch" ? "launch" : "select",
        songName,
        artistName,
      } as CommandPayloads[T];
    }
    default:
      throw new Error(`Unknown command type: ${String(type)}`);
  }
}

export function isCommandType(value: unknown): value is CommandType {
  return value === "forscore.open_score" || value === "ableton.cue_scene";
}
