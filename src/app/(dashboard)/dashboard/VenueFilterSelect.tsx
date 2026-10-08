"use client";

// "All venues" / one venue filter for the stats-style pages. A plain GET
// form field — changing it re-submits the surrounding filter form.
export default function VenueFilterSelect({
  venues,
  selectedVenueId,
}: {
  venues: { id: string; name: string }[];
  selectedVenueId?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-foreground-muted">Venue</label>
      <select
        name="venueId"
        defaultValue={selectedVenueId ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      >
        <option value="">All venues</option>
        {venues.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
    </div>
  );
}
