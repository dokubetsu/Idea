"use client";

import { useState, useMemo } from "react";
import {
  Calendar,
  CalendarPlus,
  MapPin,
  User,
  Target,
  Clock,
  Gavel,
  ChevronDown,
} from "lucide-react";
import {
  useHearings,
  useScheduleHearing,
  useUpdateHearing,
} from "@/features/docket/hooks/useCaseOverview";
import {
  Card,
  Button,
  Badge,
  StatusPill,
  Spinner,
  EmptyState,
  Input,
  cn,
} from "@/shared/components/ui";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface Props {
  matterId: string;
}

interface Hearing {
  id: string;
  matter_id: string;
  hearing_date: string;
  courtroom: string;
  judge: string;
  purpose: string;
  status: "scheduled" | "adjourned" | "completed" | "cancelled";
  notes?: string;
  outcome?: string;
}

type Outcome =
  | "Part-heard"
  | "Adjourned"
  | "Reserved for orders"
  | "Dismissed"
  | "Decreed"
  | "Compromised";

const OUTCOME_OPTIONS: Outcome[] = [
  "Part-heard",
  "Adjourned",
  "Reserved for orders",
  "Dismissed",
  "Decreed",
  "Compromised",
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }) +
    " at " +
    d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  );
}

function daysUntil(iso: string): number {
  const now = new Date();
  const target = new Date(iso);
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function generateIcs(hearing: Hearing): void {
  const start = new Date(hearing.hearing_date);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour default

  const pad = (n: number) => String(n).padStart(2, "0");
  const toIcsDate = (d: Date) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Docket//Hearing//EN",
    "BEGIN:VEVENT",
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:Hearing - ${hearing.purpose}`,
    `LOCATION:${hearing.courtroom}`,
    `DESCRIPTION:Judge: ${hearing.judge}\\nPurpose: ${hearing.purpose}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hearing-${hearing.id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function statusTone(status: Hearing["status"]): "gold" | "blue" | "teal" | "muted" {
  switch (status) {
    case "scheduled":
      return "gold";
    case "adjourned":
      return "blue";
    case "completed":
      return "teal";
    case "cancelled":
      return "muted";
  }
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function ScheduleForm({ matterId }: { matterId: string }) {
  const { mutate: schedule, isPending } = useScheduleHearing(matterId);
  const [date, setDate] = useState("");
  const [courtroom, setCourtroom] = useState("");
  const [judge, setJudge] = useState("");
  const [purpose, setPurpose] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !courtroom || !judge || !purpose) return;
    schedule(
      { hearing_date: date, courtroom, judge, purpose },
      {
        onSuccess: () => {
          setDate("");
          setCourtroom("");
          setJudge("");
          setPurpose("");
        },
      }
    );
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <CalendarPlus className="h-4 w-4 text-brand-gold" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
          Schedule New Hearing
        </span>
      </div>
      <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Date & Time"
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Input
          label="Courtroom"
          placeholder="e.g. Court Room 12"
          value={courtroom}
          onChange={(e) => setCourtroom(e.target.value)}
          required
        />
        <Input
          label="Judge"
          placeholder="e.g. Hon. Justice Sharma"
          value={judge}
          onChange={(e) => setJudge(e.target.value)}
          required
        />
        <Input
          label="Purpose"
          placeholder="e.g. Arguments on IA"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          required
        />
        <div className="flex items-end sm:col-span-2 lg:col-span-4">
          <Button type="submit" variant="gold" size="sm" disabled={isPending}>
            {isPending ? <Spinner className="h-4 w-4" /> : <CalendarPlus className="h-3.5 w-3.5" />}
            Schedule
          </Button>
        </div>
      </form>
    </Card>
  );
}

function UpcomingHearingCard({ hearing }: { hearing: Hearing }) {
  const days = daysUntil(hearing.hearing_date);
  const countdown =
    days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days away`;

  return (
    <Card className="border-l-4 border-l-brand-gold/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-blue-dark">
            <Calendar className="h-4 w-4 text-brand-gold/70" />
            {formatDateTime(hearing.hearing_date)}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-brand-blue-light/60">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {hearing.courtroom}
            </span>
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" /> {hearing.judge}
            </span>
            <span className="inline-flex items-center gap-1">
              <Target className="h-3 w-3" /> {hearing.purpose}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill tone={statusTone(hearing.status)}>{hearing.status}</StatusPill>
          <Badge tone="gold" className="text-[9px]">
            <Clock className="h-3 w-3" /> {countdown}
          </Badge>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => generateIcs(hearing)}
          aria-label="Add hearing to calendar"
        >
          <Calendar className="h-3.5 w-3.5" />
          Add to Calendar
        </Button>
      </div>
    </Card>
  );
}

function PastHearingCard({ hearing }: { hearing: Hearing }) {
  const { mutate: update, isPending } = useUpdateHearing(hearing.matter_id);
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(hearing.notes ?? "");
  const [outcome, setOutcome] = useState<string>(hearing.outcome ?? "");

  const handleSave = () => {
    update({ hearingId: hearing.id, notes, outcome });
  };

  return (
    <Card className="p-4 opacity-80 hover:opacity-100 transition-opacity">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-medium text-brand-blue-dark/70">
            <Calendar className="h-4 w-4 text-brand-blue-light/40" />
            {formatDateTime(hearing.hearing_date)}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-brand-blue-light/50">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {hearing.courtroom}
            </span>
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" /> {hearing.judge}
            </span>
            <span className="inline-flex items-center gap-1">
              <Target className="h-3 w-3" /> {hearing.purpose}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill tone={statusTone(hearing.status)}>{hearing.status}</StatusPill>
          <button
            onClick={() => setExpanded(!expanded)}
            aria-label="Toggle notes"
            className="rounded-lg p-1.5 text-brand-blue-light/40 hover:bg-base-200 hover:text-brand-blue-dark transition-colors"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                expanded && "rotate-180"
              )}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-brand-gold/8 pt-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue-light/50">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add hearing notes..."
              rows={3}
              className="w-full rounded-xl border border-brand-gold/15 bg-base-100 px-3.5 py-3 text-[13px] text-brand-blue-dark outline-none transition-all duration-200 placeholder:text-brand-blue-light/30 focus:border-brand-gold focus:bg-white focus:shadow-sm resize-none"
              aria-label="Hearing notes"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue-light/50">
              Outcome
            </label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-brand-gold/15 bg-base-100 px-3.5 text-[13px] text-brand-blue-dark outline-none transition-all duration-200 focus:border-brand-gold focus:shadow-sm"
              aria-label="Hearing outcome"
            >
              <option value="">Select outcome...</option>
              {OUTCOME_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={isPending}
              aria-label="Save hearing updates"
            >
              {isPending ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Gavel className="h-3.5 w-3.5" />
              )}
              Save
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main Component                                                             */
/* -------------------------------------------------------------------------- */

export default function HearingsTab({ matterId }: Props) {
  const { data: hearings = [], isLoading } = useHearings(matterId);

  const { upcoming, past, adjournmentCount } = useMemo(() => {
    const sorted = [...hearings].sort(
      (a: Hearing, b: Hearing) =>
        new Date(b.hearing_date).getTime() - new Date(a.hearing_date).getTime()
    );
    const upcomingList = sorted.filter(
      (h: Hearing) => h.status === "scheduled" || h.status === "adjourned"
    );
    const pastList = sorted.filter(
      (h: Hearing) => h.status === "completed" || h.status === "cancelled"
    );
    const adjCount = hearings.filter(
      (h: Hearing) => h.status === "adjourned"
    ).length;
    return { upcoming: upcomingList, past: pastList, adjournmentCount: adjCount };
  }, [hearings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with adjournment count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gavel className="h-5 w-5 text-brand-gold" />
          <h2 className="font-serif text-xl font-bold text-brand-blue-dark">
            Hearings
          </h2>
          {adjournmentCount > 0 && (
            <Badge tone="blue">
              {adjournmentCount} adjournment{adjournmentCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* Schedule Form */}
      <ScheduleForm matterId={matterId} />

      {/* Upcoming Hearings */}
      <section>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
          Upcoming
        </p>
        {upcoming.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No upcoming hearings"
            body="Schedule a new hearing using the form above."
          />
        ) : (
          <div className="space-y-3">
            {upcoming.map((h: Hearing) => (
              <UpcomingHearingCard key={h.id} hearing={h} />
            ))}
          </div>
        )}
      </section>

      {/* Past Hearings */}
      <section>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
          Past
        </p>
        {past.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No past hearings"
            body="Completed and cancelled hearings will appear here."
          />
        ) : (
          <div className="space-y-3">
            {past.map((h: Hearing) => (
              <PastHearingCard key={h.id} hearing={h} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
