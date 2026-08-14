"use client";

export default function DateRangeInputs({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) {
  function submitOnChange(e: React.ChangeEvent<HTMLInputElement>) {
    e.currentTarget.form?.requestSubmit();
  }

  return (
    <>
      <input
        type="date"
        name="dateFrom"
        defaultValue={dateFrom}
        onChange={submitOnChange}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <input
        type="date"
        name="dateTo"
        defaultValue={dateTo}
        onChange={submitOnChange}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </>
  );
}
