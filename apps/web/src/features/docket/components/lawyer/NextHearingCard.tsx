"use client";

import { useState } from "react";
import { CalendarPlus, MapPin, User, Target, Check } from "lucide-react";
import { Card, Button, cn } from "@/shared/components/ui";

interface Hearing {
  id: string;
  hearing_date: string;
  days_until: number;
  courtroom: string;
  judge: string;
  purpose: string;
}

interface NextHearingCardProps {
  hearing: Hearing | null;
  matterId: string;
}

const PREP_CHECKLIST = [
  "Brief reviewed",
  "Documents indexed",
  "Covering counsel briefed",
  "Client informed",
] as const;

function generateIcsContent(hearing: Hearing, caseNumber?: string): string {
  const hearingDate = new Date(hearing.hearing_date);
  const endDate = new Date(hearingDate.getTime() + 60 * 60 * 1000); // 1 hour

  const format = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nyaya//Docket//EN",
    "BEGIN:VEVENT",
    `DTSTART:${format(hearingDate)}`,
    `DTEND:${format(endDate)}`,
    `SUMMARY:Court Hearing${caseNumber ? ` — ${caseNumber}` : ""}`,
    `LOCATION:${hearing.courtroom || "Court"}`,
    `DESCRIPTION:Purpose: ${hearing.purpose || "Court hearing"}\\nJudge: ${hearing.judge || "TBD"}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function NextHearingCard({ hearing, matterId }: NextHearingCardProps) {
  const [checked, setChecked] = useState<boolean[]>(
    new Array(PREP_CHECKLIST.length).fill(false)
  );

  if (!hearing) return null;

  const toggleCheck = (index: number) => {
    setChecked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const handleAddToCalendar = () => {
    const icsContent = generateIcsContent(hearing);
    const blob = new Blob([icsContent], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hearing-${hearing.id.slice(0, 8)}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isUrgent = hearing.days_until <= 7;
  const completedCount = checked.filter(Boolean).length;

  const formattedDate = new Date(hearing.hearing_date).toLocaleDateString(
    "en-IN",
    {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );

  const formattedTime = new Date(hearing.hearing_date).toLocaleTimeString(
    "en-IN",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  return (
    <Card className="rounded-xl border border-brand-gold/12 bg-base-100 shadow-sm border-l-4 border-l-brand-gold overflow-hidden">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-serif font-semibold text-foreground">
            Next hearing
          </h3>
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={handleAddToCalendar}
            aria-label="Download calendar event file"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            <span className="text-[11px]">Add to calendar</span>
          </Button>
        </div>

        {/* Countdown */}
        <div className="flex items-baseline gap-2 mb-3">
          <span
            className={cn(
              "text-2xl font-serif font-bold",
              isUrgent ? "text-amber-600" : "text-brand-blue-dark"
            )}
          >
            {hearing.days_until}
          </span>
          <span className="text-[11px] font-sans text-muted-foreground">
            days away
          </span>
        </div>

        {/* Details */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <CalendarPlus className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-sans text-foreground">
              {formattedDate} at {formattedTime}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-sans text-foreground">
              {hearing.courtroom}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-sans text-foreground">
              {hearing.judge}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-sans text-foreground">
              {hearing.purpose}
            </span>
          </div>
        </div>

        {/* Prep checklist (shown when urgent) */}
        {isUrgent && (
          <div className="mt-4 pt-3 border-t border-dashed border-brand-gold/12">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-sans">
                Hearing prep checklist
              </span>
              {completedCount === PREP_CHECKLIST.length && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-brand-teal">
                  <Check className="h-3 w-3" />
                  Ready
                </span>
              )}
            </div>
            <ul className="space-y-1.5">
              {PREP_CHECKLIST.map((item, index) => (
                <li key={item} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked[index]}
                    onChange={() => toggleCheck(index)}
                    className="h-3.5 w-3.5 rounded border-brand-gold/30 text-brand-gold focus:ring-brand-gold/20"
                    aria-label={item}
                  />
                  <span
                    className={cn(
                      "text-[11px] font-sans",
                      checked[index]
                        ? "line-through text-muted-foreground"
                        : "text-foreground"
                    )}
                  >
                    {item}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {completedCount}/{PREP_CHECKLIST.length} completed
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}