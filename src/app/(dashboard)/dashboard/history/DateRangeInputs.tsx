"use client";

import { useEffect, useRef, useState } from "react";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISO(value: string | undefined): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDisplay(date: Date): string {
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function CalendarField({
  name,
  label,
  initial,
}: {
  name: string;
  label: string;
  initial: string | undefined;
}) {
  const [value, setValue] = useState(initial ?? "");
  const selected = parseISO(value);
  const today = new Date();

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());

  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function commit(next: string) {
    setValue(next);
    setOpen(false);
    if (hiddenRef.current) {
      hiddenRef.current.value = next;
      hiddenRef.current.form?.requestSubmit();
    }
  }

  function changeMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  const firstWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Monday = 0
  const numDays = daysInMonth(viewYear, viewMonth);

  return (
    <div className="relative flex items-center gap-2" ref={containerRef}>
      <span className="text-sm text-foreground-muted w-10 shrink-0">{label}</span>
      <input type="hidden" name={name} ref={hiddenRef} defaultValue={initial ?? ""} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none hover:border-accent focus:border-accent min-w-32 text-left"
      >
        {selected ? formatDisplay(selected) : "Any"}
      </button>

      {open && (
        <div className="absolute top-full left-10 z-20 mt-1 w-64 rounded-lg border border-border bg-surface p-3 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="rounded px-2 py-1 text-sm text-foreground-muted hover:text-accent hover:bg-surface-elevated"
            >
              ‹
            </button>
            <span className="text-sm font-medium">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="rounded px-2 py-1 text-sm text-foreground-muted hover:text-accent hover:bg-surface-elevated"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-xs text-foreground-muted mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: numDays }, (_, i) => i + 1).map((day) => {
              const isSelected =
                selected &&
                selected.getFullYear() === viewYear &&
                selected.getMonth() === viewMonth &&
                selected.getDate() === day;
              const isToday =
                today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => commit(toISO(new Date(viewYear, viewMonth, day)))}
                  className={`h-7 w-7 rounded text-xs ${
                    isSelected
                      ? "bg-accent text-accent-foreground font-medium"
                      : isToday
                        ? "text-accent hover:bg-surface-elevated"
                        : "text-foreground hover:bg-surface-elevated"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          {selected && (
            <button
              type="button"
              onClick={() => commit("")}
              className="mt-2 text-xs text-foreground-muted hover:text-accent"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function DateRangeInputs({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <CalendarField name="dateFrom" label="From" initial={dateFrom} />
      <CalendarField name="dateTo" label="To" initial={dateTo} />
    </div>
  );
}
