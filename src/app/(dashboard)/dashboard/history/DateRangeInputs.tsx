"use client";

import { useRef, useState } from "react";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear - 4 + i);

type Parts = { day: string; month: string; year: string };

function parseDate(value: string | undefined): Parts {
  if (!value) return { day: "", month: "", year: "" };
  const [year, month, day] = value.split("-");
  return { day: day ?? "", month: month ?? "", year: year ?? "" };
}

const selectClass =
  "rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none focus:border-accent";

function DateField({ name, initial }: { name: string; initial: string | undefined }) {
  const [parts, setParts] = useState<Parts>(() => parseDate(initial));
  const hiddenRef = useRef<HTMLInputElement>(null);

  function update(next: Parts) {
    setParts(next);
    const complete = next.day && next.month && next.year;
    const value = complete ? `${next.year}-${next.month}-${next.day}` : "";
    if (hiddenRef.current) {
      hiddenRef.current.value = value;
      hiddenRef.current.form?.requestSubmit();
    }
  }

  return (
    <div className="flex gap-1">
      <input type="hidden" name={name} ref={hiddenRef} defaultValue={initial ?? ""} />
      <select
        aria-label={`${name} day`}
        value={parts.day}
        onChange={(e) => update({ ...parts, day: e.target.value })}
        className={selectClass}
      >
        <option value="">Day</option>
        {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        aria-label={`${name} month`}
        value={parts.month}
        onChange={(e) => update({ ...parts, month: e.target.value })}
        className={selectClass}
      >
        <option value="">Month</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={String(i + 1).padStart(2, "0")}>
            {m}
          </option>
        ))}
      </select>
      <select
        aria-label={`${name} year`}
        value={parts.year}
        onChange={(e) => update({ ...parts, year: e.target.value })}
        className={selectClass}
      >
        <option value="">Year</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function DateRangeInputs({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) {
  return (
    <>
      <DateField name="dateFrom" initial={dateFrom} />
      <DateField name="dateTo" initial={dateTo} />
    </>
  );
}
