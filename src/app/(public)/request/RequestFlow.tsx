"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createRequest, createRequestWithTip, retryTipPayment } from "@/actions/requests";
import { logSearch } from "@/actions/search-log";
import type { SongResult } from "@/lib/search";
import PaymentStep from "./PaymentStep";

type Props = {
  songDatabaseId: string;
  initialSongs: SongResult[];
  artists: string[];
  decades: string[];
  tipPresetsCents: number[];
};

type Step = "browse" | "details" | "payment" | "confirmation";
type BrowseMode = "songs" | "artists" | "decades";
type TipOption = number | "other" | null;

export default function RequestFlow({ songDatabaseId, initialSongs, artists, decades, tipPresetsCents }: Props) {
  const tipPresets = tipPresetsCents.map((cents) => ({ cents, label: `$${(cents / 100).toFixed(0)}` }));
  const [step, setStep] = useState<Step>("browse");
  const [browseMode, setBrowseMode] = useState<BrowseMode>("songs");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SongResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [selectedDecade, setSelectedDecade] = useState<string | null>(null);
  const [selectedSong, setSelectedSong] = useState<SongResult | null>(null);

  const [requesterName, setRequesterName] = useState("");
  const [giveShoutOut, setGiveShoutOut] = useState(false);
  const [shoutOut, setShoutOut] = useState("");
  const [tipOption, setTipOption] = useState<TipOption>(null);
  const [otherAmountDollars, setOtherAmountDollars] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const tipAmountCents = useMemo(() => {
    if (tipOption === null) return 0;
    if (tipOption === "other") {
      const dollars = parseFloat(otherAmountDollars);
      if (!Number.isFinite(dollars) || dollars <= 0) return 0;
      return Math.round(dollars * 100);
    }
    return tipOption;
  }, [tipOption, otherAmountDollars]);

  // Live-typing search debounce — kept short so results feel instant. This is
  // separate from the ~1000ms debounce below, which decides when a search is
  // "settled" enough to log for Search Analytics.
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    let cancelled = false;
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/songs/search?databaseId=${encodeURIComponent(songDatabaseId)}&q=${encodeURIComponent(trimmed)}`
        );
        const data = await res.json();
        if (!cancelled) setSearchResults(data.results ?? []);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [searchQuery, songDatabaseId]);

  // Search Analytics: log on submit / result-select / debounce-settle — never
  // per keystroke (locked decision). This UI has no explicit "submit" button
  // (search is live-as-you-type), so in practice logging happens either here
  // (query settled ~1s with no further typing) or in selectSong (user picked
  // a result before this timer fired). searchLoggedRef prevents double-
  // logging the same search term from both paths.
  const searchLoggedRef = useRef(false);
  const searchResultsRef = useRef<SongResult[] | null>(null);
  useEffect(() => {
    searchResultsRef.current = searchResults;
  }, [searchResults]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    const handle = setTimeout(() => {
      if (searchLoggedRef.current) return;
      searchLoggedRef.current = true;
      logSearch({
        songDatabaseId,
        searchTerm: trimmed,
        resultsFound: (searchResultsRef.current ?? []).length > 0,
        eventType: "debounce",
      });
    }, 1000);
    return () => clearTimeout(handle);
  }, [searchQuery, songDatabaseId]);

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    searchLoggedRef.current = false;
    if (!value.trim()) setSearchResults(null);
  }

  const visibleSongs = useMemo(() => {
    if (searchQuery.trim()) return searchResults ?? [];
    if (browseMode === "artists" && selectedArtist) {
      return initialSongs.filter((s) => s.artist === selectedArtist);
    }
    if (browseMode === "decades" && selectedDecade) {
      return initialSongs.filter((s) => s.decade === selectedDecade);
    }
    if (browseMode === "songs") return initialSongs;
    return [];
  }, [searchQuery, searchResults, browseMode, selectedArtist, selectedDecade, initialSongs]);

  function selectSong(song: SongResult) {
    const trimmed = searchQuery.trim();
    if (trimmed && !searchLoggedRef.current) {
      searchLoggedRef.current = true;
      logSearch({ songDatabaseId, searchTerm: trimmed, resultsFound: true, eventType: "select" });
    }
    setSelectedSong(song);
    setStep("details");
    setError(null);
  }

  function backToBrowse() {
    setStep("browse");
    setSelectedSong(null);
    setRequesterName("");
    setGiveShoutOut(false);
    setShoutOut("");
    setTipOption(null);
    setOtherAmountDollars("");
    setCreatedRequestId(null);
    setClientSecret(null);
    setError(null);
  }

  async function handleContinue() {
    if (!selectedSong) return;
    if (!requesterName.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (tipOption === "other" && tipAmountCents < 50) {
      setError("Please enter a valid tip amount (at least $0.50).");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (tipAmountCents === 0) {
        await createRequest({
          songDatabaseId,
          songId: selectedSong.id,
          songName: selectedSong.name,
          artistName: selectedSong.artist,
          decade: selectedSong.decade,
          requesterName,
          shoutOut: giveShoutOut ? shoutOut : null,
        });
        setStep("confirmation");
        return;
      }

      // Already created a request for this song (e.g. came back from the
      // payment step and changed the amount) — reuse the same row rather
      // than creating a duplicate.
      if (createdRequestId) {
        const result = await retryTipPayment(createdRequestId, tipAmountCents);
        setClientSecret(result.clientSecret);
        setStep("payment");
        return;
      }

      const result = await createRequestWithTip({
        songDatabaseId,
        songId: selectedSong.id,
        songName: selectedSong.name,
        artistName: selectedSong.artist,
        decade: selectedSong.decade,
        requesterName,
        shoutOut: giveShoutOut ? shoutOut : null,
        tipAmountCents,
      });
      setCreatedRequestId(result.id);
      setClientSecret(result.clientSecret);
      setStep("payment");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "confirmation") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-6">
        <h1 className="text-2xl font-semibold">Request received!</h1>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link
            href="/queue"
            className="rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-foreground hover:bg-accent-hover text-center"
          >
            View Queue
          </Link>
          <Link
            href="/profile"
            className="rounded-lg border border-border px-4 py-3 text-sm font-medium hover:border-accent text-center"
          >
            Follow Lochie
          </Link>
        </div>
      </div>
    );
  }

  if (step === "payment" && clientSecret) {
    return (
      <PaymentStep
        clientSecret={clientSecret}
        amountCents={tipAmountCents}
        onSuccess={() => setStep("confirmation")}
        onBack={() => setStep("details")}
      />
    );
  }

  if (step === "details" && selectedSong) {
    return (
      <div className="min-h-screen px-4 py-6 max-w-md mx-auto flex flex-col gap-6">
        <button onClick={backToBrowse} className="text-sm text-foreground-muted text-left hover:text-foreground">
          ← Back
        </button>

        <div>
          <p className="text-xl font-semibold">{selectedSong.name}</p>
          <p className="text-foreground-muted">{selectedSong.artist}</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="requesterName">
            Your Name
          </label>
          <input
            id="requesterName"
            type="text"
            value={requesterName}
            onChange={(e) => setRequesterName(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-3 text-base outline-none focus:border-accent"
            placeholder="Your name"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={giveShoutOut}
            onChange={(e) => setGiveShoutOut(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Give someone a shout-out
        </label>

        {giveShoutOut && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="shoutOut">
              Shout-out
            </label>
            <input
              id="shoutOut"
              type="text"
              value={shoutOut}
              onChange={(e) => setShoutOut(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-3 text-base outline-none focus:border-accent"
              placeholder="e.g. Happy Birthday Sarah!"
            />
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <div>
            <p className="font-medium text-tip">Leave Lochie a tip</p>
            <p className="text-xs text-foreground-muted mt-1">
              Tipped requests move further toward the front of the queue. The bigger the tip, the higher your
              request moves.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {tipPresets.map((preset) => (
              <button
                key={preset.cents}
                type="button"
                onClick={() => setTipOption(tipOption === preset.cents ? null : preset.cents)}
                className={`flex-1 min-w-16 rounded-lg px-2 py-2 text-sm font-medium ${
                  tipOption === preset.cents
                    ? "bg-tip text-background"
                    : "border border-border text-foreground-muted hover:text-foreground"
                }`}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTipOption(tipOption === "other" ? null : "other")}
              className={`flex-1 min-w-16 rounded-lg px-2 py-2 text-xs font-medium ${
                tipOption === "other"
                  ? "bg-tip text-background"
                  : "border border-border text-foreground-muted hover:text-foreground"
              }`}
            >
              Other
            </button>
          </div>

          {tipOption === "other" && (
            <input
              type="number"
              inputMode="decimal"
              min="0.5"
              step="0.5"
              value={otherAmountDollars}
              onChange={(e) => setOtherAmountDollars(e.target.value)}
              placeholder="Custom amount"
              className="rounded-lg border border-border bg-background px-3 py-2 text-base outline-none focus:border-accent"
            />
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          onClick={handleContinue}
          disabled={submitting}
          className="rounded-lg bg-accent px-4 py-3 text-base font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting
            ? "Submitting…"
            : tipAmountCents > 0
              ? `Continue to Payment · $${(tipAmountCents / 100).toFixed(2)}`
              : "Submit Request"}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Request a Song</h1>

      <input
        type="text"
        value={searchQuery}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder="Search songs or artists…"
        className="rounded-lg border border-border bg-surface px-3 py-3 text-base outline-none focus:border-accent"
      />

      {!searchQuery.trim() && (
        <div className="flex gap-2">
          {(["songs", "artists", "decades"] as BrowseMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setBrowseMode(mode);
                setSelectedArtist(null);
                setSelectedDecade(null);
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize ${
                browseMode === mode
                  ? "bg-accent text-accent-foreground"
                  : "border border-border text-foreground-muted hover:text-foreground"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      )}

      {!searchQuery.trim() && browseMode === "artists" && !selectedArtist && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {artists.map((artist) => (
            <li key={artist}>
              <button
                onClick={() => setSelectedArtist(artist)}
                className="w-full text-left px-4 py-3 hover:bg-surface-elevated"
              >
                {artist}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!searchQuery.trim() && browseMode === "decades" && !selectedDecade && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {decades.map((decade) => (
            <li key={decade}>
              <button
                onClick={() => setSelectedDecade(decade)}
                className="w-full text-left px-4 py-3 hover:bg-surface-elevated"
              >
                {decade}
              </button>
            </li>
          ))}
        </ul>
      )}

      {((!searchQuery.trim() && browseMode === "songs") ||
        (!searchQuery.trim() && browseMode === "artists" && selectedArtist) ||
        (!searchQuery.trim() && browseMode === "decades" && selectedDecade) ||
        searchQuery.trim()) && (
        <>
          {!searchQuery.trim() && (browseMode === "artists" ? selectedArtist : selectedDecade) && (
            <button
              onClick={() => (browseMode === "artists" ? setSelectedArtist(null) : setSelectedDecade(null))}
              className="text-sm text-foreground-muted text-left hover:text-foreground"
            >
              ← {browseMode === "artists" ? "All artists" : "All decades"}
            </button>
          )}

          {searching && <p className="text-sm text-foreground-muted">Searching…</p>}

          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {visibleSongs.map((song) => (
              <li key={song.id}>
                <button
                  onClick={() => selectSong(song)}
                  className="w-full text-left px-4 py-3 hover:bg-surface-elevated"
                >
                  <p className="font-medium">{song.name}</p>
                  <p className="text-xs text-foreground-muted">
                    {song.artist}
                    {song.decade ? ` · ${song.decade}` : ""}
                  </p>
                </button>
              </li>
            ))}
            {visibleSongs.length === 0 && !searching && (
              <li className="px-4 py-6 text-sm text-foreground-muted text-center">No songs found.</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
