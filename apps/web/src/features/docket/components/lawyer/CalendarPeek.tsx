"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { Card, Button, cn } from "@/shared/components/ui";

interface HearingDateInfo {
  date: string; // ISO date (YYYY-MM-DD)
  matter_id: string;
  case_name: string;
  purpose?: string;
}

interface CalendarPeekProps {
  hearingDates: string[]; // ISO date strings, e.g. "2026-07-15"
  hearingDetails?: HearingDateInfo[]; // enriched data for tooltips/navigation
}

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function CalendarPeek({ hearingDates, hearingDetails = [] }: CalendarPeekProps) {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const year = today.getFullYear();
  const month = today.getMonth();

  const { daysInMonth, firstWeekday, monthLabel } = useMemo(() => {
    return {
      daysInMonth: new Date(year, month + 1, 0).getDate(),
      firstWeekday: new Date(year, month, 1).getDay(),
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

  // Map day-of-month to hearing details for tooltip
  const hearingDayMap = useMemo(() => {
    const m = new Map<number, HearingDateInfo[]>();
    for (const info of hearingDetails) {
      const d = new Date(info.date);
      if (!isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!m.has(day)) m.set(day, []);
        m.get(day)!.push(info);
      }
    }
    return m;
  }, [hearingDetails, year, month]);

  const todayDate = today.getDate();
  const totalCells = firstWeekday + daysInMonth;
  const trailingEmpties = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);

  // Tooltip state
  const [tooltipDay, setTooltipDay] = useState<number | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Schedule modal state
  const [scheduleDay, setScheduleDay] = useState<number | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setTooltipDay(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleDayClick = (day: number) => {
    const hasHearing = hearingDaySet.has(day);
    const details = hearingDayMap.get(day);

    if (hasHearing && details && details.length > 0) {
      // Navigate to the first case on that day
      router.push(`/lawyer/matters/${details[0].matter_id}`);
    } else {
      // Open schedule prompt for that date
      const isPast = day < todayDate;
      if (!isPast) {
        setScheduleDay(day);
      }
    }
  };

  const handleDayHover = (day: number) => {
    if (hearingDaySet.has(day)) {
      setTooltipDay(day);
    }
  };

  const handleDayLeave = () => {
    setTooltipDay(null);
  };

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
        className="grid grid-cols-7 gap-y-0.5 text-center relative"
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
          const details = hearingDayMap.get(day);

          return (
            <div key={day} className="relative" ref={tooltipDay === day ? tooltipRef : undefined}>
              <button
                type="button"
                role="gridcell"
                aria-label={`${day}${hasHearing ? ", hearing scheduled — click to view" : ""}${isToday ? ", today" : ""}${!hasHearing && !isPast ? " — click to schedule" : ""}`}
                onClick={() => handleDayClick(day)}
                onMouseEnter={() => handleDayHover(day)}
                onMouseLeave={handleDayLeave}
                disabled={isPast && !hasHearing}
                className={cn(
                  "relative mx-auto flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-medium transition-colors",
                  isToday && "bg-brand-gold/15 font-bold text-brand-gold ring-1 ring-brand-gold/30",
                  !isToday && isPast && !hasHearing && "text-brand-blue-light/25 cursor-default",
                  !isToday && !isPast && !hasHearing && "text-brand-blue-light/65 hover:bg-brand-gold/8 cursor-pointer",
                  hasHearing && !isToday && "text-brand-gold font-semibold hover:bg-brand-gold/12 cursor-pointer",
                  hasHearing && isPast && "text-brand-gold/60 cursor-pointer",
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
              </button>

              {/* Tooltip on hover */}
              {tooltipDay === day && hasHearing && details && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 rounded-lg border border-brand-gold/20 bg-base-100 p-2.5 shadow-lg">
                  {details.map((d) => (
                    <div key={d.matter_id} className="mb-1 last:mb-0">
                      <p className="text-[11px] font-semibold text-brand-blue-dark truncate">
                        {d.case_name}
                      </p>
                      {d.purpose && (
                        <p className="text-[10px] text-brand-blue-light/55 truncate">
                          {d.purpose}
                        </p>
                      )}
                    </div>
                  ))}
                  <p className="text-[9px] text-brand-blue-light/40 mt-1">Click to view case</p>
                </div>
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
        <span className="text-[10px] text-brand-blue-light/45">Court date (click to view)</span>
        <span
          className="ml-3 h-6 w-6 rounded-lg bg-brand-gold/15 ring-1 ring-brand-gold/30 inline-flex items-center justify-center text-[10px] font-bold text-brand-gold"
          aria-hidden="true"
        >
          {todayDate}
        </span>
        <span className="text-[10px] text-brand-blue-light/45">Today</span>
      </div>

      {/* Schedule hearing mini-modal */}
      {scheduleDay !== null && (
        <ScheduleHearingMini
          day={scheduleDay}
          month={month}
          year={year}
          onClose={() => setScheduleDay(null)}
        />
      )}
    </Card>
  );
}

// ── Inline schedule hearing mini-form ───────────────────────────

interface ScheduleHearingMiniProps {
  day: number;
  month: number;
  year: number;
  onClose: () => void;
}

function ScheduleHearingMini({ day, month, year, onClose }: ScheduleHearingMiniProps) {
  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const displayDate = new Date(year, month, day).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="mt-4 pt-4 border-t border-brand-gold/12">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-gold">
          Schedule on {displayDate}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] text-brand-blue-light/40 hover:text-brand-blue-light/70"
          aria-label="Close schedule form"
        >
          ✕
        </button>
      </div>
      <p className="text-[11px] text-brand-blue-light/55 mb-3">
        Navigate to a case to schedule a hearing on this date. The date ({dateStr}) will be pre-filled.
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            // Store the date in sessionStorage for pre-filling
            sessionStorage.setItem("schedule_hearing_date", dateStr);
            onClose();
          }}
          aria-label="Remember date and schedule later"
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          <span className="text-[11px]">Remember date</span>
        </Button>
      </div>
    </div>
  );
}