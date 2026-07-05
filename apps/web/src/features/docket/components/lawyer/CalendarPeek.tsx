"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Gavel, Video, Phone, MapPin, Loader2, ChevronLeft } from "lucide-react";
import { Card, Button, Select, Input, Textarea, cn } from "@/shared/components/ui";
import { useScheduleHearing } from "@/features/docket/hooks/useCaseOverview";
import { useCreateMeeting } from "@/features/matters/hooks/useMatters";
import type { CaseCard } from "@/features/docket/types";

interface HearingDateInfo {
  date: string; // ISO date (YYYY-MM-DD)
  matter_id: string;
  case_name: string;
  purpose?: string;
}

interface CalendarPeekProps {
  hearingDates: string[]; // ISO date strings, e.g. "2026-07-15"
  hearingDetails?: HearingDateInfo[]; // enriched data for tooltips/navigation
  cases?: CaseCard[]; // cases the lawyer can schedule against
}

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function CalendarPeek({ hearingDates, hearingDetails = [], cases = [] }: CalendarPeekProps) {
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

      {/* Schedule modal */}
      {scheduleDay !== null && (
        <ScheduleModal
          day={scheduleDay}
          month={month}
          year={year}
          cases={cases}
          onClose={() => setScheduleDay(null)}
        />
      )}
    </Card>
  );
}

// ── Schedule modal: pick a case, then a hearing/meeting form ────

interface ScheduleModalProps {
  day: number;
  month: number;
  year: number;
  cases: CaseCard[];
  onClose: () => void;
}

type ScheduleType = "hearing" | "meeting";
type MeetingMode = "video" | "phone" | "in_person";

function ScheduleModal({ day, month, year, cases, onClose }: ScheduleModalProps) {
  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const displayDate = new Date(year, month, day).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });

  const dialogRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<"case" | "form">("case");
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [scheduleType, setScheduleType] = useState<ScheduleType>("hearing");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Hearing fields
  const [time, setTime] = useState("10:00");
  const [courtroom, setCourtroom] = useState("");
  const [judge, setJudge] = useState("");
  const [purpose, setPurpose] = useState("");

  // Meeting fields
  const [duration, setDuration] = useState(30);
  const [mode, setMode] = useState<MeetingMode>("video");
  const [meetingLink, setMeetingLink] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const scheduleHearing = useScheduleHearing(selectedCaseId || "no-case-selected");
  const createMeeting = useCreateMeeting(selectedCaseId || "no-case-selected");

  const selectedCase = cases.find((c) => c.id === selectedCaseId) || null;
  const isSubmitting = scheduleHearing.isPending || createMeeting.isPending;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handlePickCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setStep("form");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId) return;
    const scheduledAt = new Date(`${dateStr}T${time || "10:00"}:00`).toISOString();

    if (scheduleType === "hearing") {
      scheduleHearing.mutate(
        {
          hearing_date: scheduledAt,
          courtroom: courtroom || undefined,
          judge: judge || undefined,
          purpose: purpose || undefined,
        },
        { onSuccess: onClose }
      );
    } else {
      createMeeting.mutate(
        {
          scheduled_at: scheduledAt,
          duration_minutes: duration,
          mode,
          meeting_link: mode === "video" ? meetingLink || undefined : undefined,
          location: mode !== "video" ? location || undefined : undefined,
          notes: notes || undefined,
        },
        { onSuccess: onClose }
      );
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-modal-title"
        className="w-full max-w-md"
      >
        <Card className="relative max-h-[85vh] overflow-y-auto p-5">
          <div className="mb-4 flex items-center justify-between border-b border-brand-gold/12 pb-3">
            <div className="flex items-center gap-2">
              {step === "form" && (
                <button
                  type="button"
                  onClick={() => setStep("case")}
                  aria-label="Back to case selection"
                  className="rounded-md p-1 text-brand-blue-light/40 hover:text-brand-blue-dark"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <div>
                <h3 id="schedule-modal-title" className="font-serif text-lg font-bold text-brand-blue-dark">
                  Schedule on {displayDate}
                </h3>
                {step === "form" && selectedCase && (
                  <p className="text-[11px] text-brand-blue-light/55 truncate">
                    {selectedCase.case_name} · {selectedCase.client_name}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close schedule form"
              className="text-brand-blue-light/50 hover:text-brand-blue-dark"
            >
              ✕
            </button>
          </div>

          {/* Step 1: choose case */}
          {step === "case" && (
            <div className="space-y-2">
              <p className="mb-2 text-[11px] text-brand-blue-light/55">
                Choose which case this is for.
              </p>
              {cases.length === 0 ? (
                <p className="py-4 text-center text-sm text-brand-blue-light/45">
                  No active cases found.
                </p>
              ) : (
                <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                  {cases.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handlePickCase(c.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-brand-gold/10 bg-white px-3 py-2.5 text-left transition-colors hover:border-brand-gold/30 hover:bg-brand-gold/5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-brand-blue-dark">
                          {c.case_name}
                        </p>
                        <p className="truncate text-[11px] text-brand-blue-light/50">
                          {c.client_name}
                          {c.case_number ? ` · ${c.case_number}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-gold">
                        Select
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: form */}
          {step === "form" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleType("hearing")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-colors",
                    scheduleType === "hearing"
                      ? "border-brand-gold/40 bg-brand-gold/12 text-brand-gold"
                      : "border-black/8 text-brand-blue-light/50 hover:border-brand-gold/20"
                  )}
                >
                  <Gavel className="h-3.5 w-3.5" />
                  Court Hearing
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleType("meeting")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-colors",
                    scheduleType === "meeting"
                      ? "border-brand-gold/40 bg-brand-gold/12 text-brand-gold"
                      : "border-black/8 text-brand-blue-light/50 hover:border-brand-gold/20"
                  )}
                >
                  <Video className="h-3.5 w-3.5" />
                  Client Call / Meeting
                </button>
              </div>

              {/* Common: time */}
              <div className="grid grid-cols-2 gap-3">
                <Input label="Date" type="date" value={dateStr} disabled />
                <Input
                  label="Time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>

              {scheduleType === "hearing" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Courtroom (optional)"
                      placeholder="e.g. Court Room 4"
                      value={courtroom}
                      onChange={(e) => setCourtroom(e.target.value)}
                    />
                    <Input
                      label="Judge (optional)"
                      placeholder="e.g. Hon. Justice Rao"
                      value={judge}
                      onChange={(e) => setJudge(e.target.value)}
                    />
                  </div>
                  <Textarea
                    label="Purpose (optional)"
                    placeholder="e.g. Evidence recording, arguments"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    rows={2}
                  />
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label="Mode"
                      value={mode}
                      onChange={(e) => setMode(e.target.value as MeetingMode)}
                    >
                      <option value="video">Video Call</option>
                      <option value="phone">Phone Call</option>
                      <option value="in_person">In Person</option>
                    </Select>
                    <Input
                      label="Duration (minutes)"
                      type="number"
                      min={10}
                      step={5}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value) || 30)}
                    />
                  </div>

                  {mode === "video" && (
                    <Input
                      label="Meeting Link (optional)"
                      placeholder="e.g. https://meet.google.com/..."
                      value={meetingLink}
                      onChange={(e) => setMeetingLink(e.target.value)}
                    />
                  )}
                  {mode === "phone" && (
                    <Input
                      label="Phone Number (optional)"
                      placeholder="e.g. +91 98765 43210"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  )}
                  {mode === "in_person" && (
                    <Input
                      label="Location / Address (optional)"
                      placeholder="e.g. Chamber No. 12, Court Complex"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  )}

                  <Textarea
                    label="Notes (optional)"
                    placeholder="What should be discussed?"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </>
              )}

              <div className="flex justify-end gap-2 border-t border-brand-gold/8 pt-3">
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="gold" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : scheduleType === "hearing" ? (
                    <Gavel className="h-3.5 w-3.5" />
                  ) : mode === "video" ? (
                    <Video className="h-3.5 w-3.5" />
                  ) : mode === "phone" ? (
                    <Phone className="h-3.5 w-3.5" />
                  ) : (
                    <MapPin className="h-3.5 w-3.5" />
                  )}
                  {scheduleType === "hearing" ? "Schedule Hearing" : "Schedule Meeting"}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>,
    document.body
  );
}
