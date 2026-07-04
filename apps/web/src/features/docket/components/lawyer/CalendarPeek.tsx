"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, cn } from "@/shared/components/ui";

interface CalendarPeekProps {
  hearingDates: string[]; // ISO date strings, e.g. "2026-07-15"
}

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function CalendarPeek({ hearingDates }: CalendarPeekProps) {
  // Always show the current month — no navigation needed for a "peek"
  const today = useMemo(() => new Date(), []);
  const year = today.getFullYear();
  const month = today.getMonth();

  const { daysInMonth, firstWeekday, monthLabel } = useMemo(() => {
    return {
      daysInMonth: new Date(year, month + 1, 0).getDate(),
      firstWeekday: new Date(year, month, 1).getDay(), // 0 = Sunday
      monthLabel: today.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    };
  }, [year, month, today]);

  // Build a set of day-of-month numbers that have hearings this month
  const hearingDaySet = useMemo(() => {
    const s = new Set<number>();
    for (const iso of hearingDates) {
      const d = new Date(iso);
      if (!isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month) {
        s.add(d.getDate());
      }
    }
    return s;
  }, [hearingDates, year, month]);

  const todayDate = today.getDate();

  // Total cell count: leading empties + days
  const totalCells = firstWeekday + daysInMonth;
  // Pad to complete the last week row
  const trailingEmpties = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);

  return (
    <Card className="p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
            Calendar
          </p>
          <p className="mt-0.5 font-serif text-base font-bold text-brand-blue-dark capitalize">
            {monthLabel}
          </p>
        </div>
        {hearingDaySet.size > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-gold/20 bg-brand-gold/8 px-2.5 py-1 text-[10px] font-semibold text-brand-gold">
            {hearingDaySet.size} hearing{hearingDaySet.size !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Weekday row */}
      <div className="mb-1 grid grid-cols-7 text-center" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="pb-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-brand-blue-light/35"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        className="grid grid-cols-7 gap-y-0.5 text-center"
        role="grid"
        aria-label={`Calendar for ${monthLabel}`}
      >
        {/* Leading empties */}
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`lead-${i}`} role="gridcell" aria-hidden="true" />
        ))}

        {/* Actual days */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const isToday = day === todayDate;
          const hasHearing = hearingDaySet.has(day);
          const isPast = day < todayDate;

          return (
            <div
              key={day}
              role="gridcell"
              aria-label={`${day}${hasHearing ? ", hearing scheduled" : ""}${isToday ? ", today" : ""}`}
              className={cn(
                "relative mx-auto flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-medium transition-colors",
                isToday && "bg-brand-gold/15 font-bold text-brand-gold ring-1 ring-brand-gold/30",
                !isToday && isPast && "text-brand-blue-light/25",
                !isToday && !isPast && "text-brand-blue-light/65 hover:bg-brand-gold/8",
              )}
            >
              {day}
              {hasHearing && (
                <span
                  className={cn(
                    "absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full",
                    isToday ? "bg-brand-gold" : "bg-brand-gold/70",
                  )}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}

        {/* Trailing empties */}
        {Array.from({ length: trailingEmpties }).map((_, i) => (
          <div key={`trail-${i}`} role="gridcell" aria-hidden="true" />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-2 border-t border-brand-gold/8 pt-3">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" aria-hidden="true" />
        <span className="text-[10px] text-brand-blue-light/45">Court date</span>
        <span
          className="ml-3 h-6 w-6 rounded-lg bg-brand-gold/15 ring-1 ring-brand-gold/30 inline-flex items-center justify-center text-[10px] font-bold text-brand-gold"
          aria-hidden="true"
        >
          {todayDate}
        </span>
        <span className="text-[10px] text-brand-blue-light/45">Today</span>
      </div>
    </Card>
  );
}
