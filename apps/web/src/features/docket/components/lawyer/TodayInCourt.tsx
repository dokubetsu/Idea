"use client";

import Link from "next/link";
import { Gavel, MapPin, User, FileText, Calendar } from "lucide-react";
import { Card, EmptyState } from "@/shared/components/ui";
import type { HearingRow } from "@/features/docket/types";

interface TodayInCourtProps {
  hearings: HearingRow[];
}

export function TodayInCourt({ hearings }: TodayInCourtProps) {
  return (
    <Card className="flex flex-col">
      <div className="border-b border-brand-gold/10 px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
          Today in court
        </p>
        <p className="mt-0.5 text-sm text-brand-blue-light/55">
          {hearings.length === 0
            ? "No hearings scheduled today"
            : `${hearings.length} hearing${hearings.length > 1 ? "s" : ""} scheduled`}
        </p>
      </div>

      {hearings.length === 0 ? (
        <div className="px-5">
          <EmptyState
            icon={Gavel}
            title="No hearings today"
            body="You have a clear schedule today. Enjoy the time for case preparation."
          />
        </div>
      ) : (
        <ol className="divide-y divide-brand-gold/8" aria-label="Today's hearings">
          {hearings.map((h, index) => (
            <li key={h.id}>
              <Link
                href={`/lawyer/matters/${h.matter_id}`}
                className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-brand-gold/4"
                aria-label={`${h.case_name} at ${h.time}`}
              >
                {/* Timeline dot and line */}
                <div className="relative flex flex-col items-center pt-0.5" aria-hidden="true">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand-gold/30 bg-brand-gold/10 text-[10px] font-bold text-brand-gold">
                    {index + 1}
                  </span>
                  {index < hearings.length - 1 && (
                    <span className="mt-1 w-px flex-1 bg-brand-gold/15" style={{ minHeight: "1rem" }} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {/* Time */}
                  <p className="text-[11px] font-semibold tabular-nums text-brand-gold">
                    {h.time}
                  </p>

                  {/* Case name */}
                  <p className="mt-0.5 font-serif text-base font-bold text-brand-blue-dark group-hover:text-brand-accent transition-colors line-clamp-1">
                    {h.case_name}
                  </p>

                  {/* Meta row */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {h.court && (
                      <span className="flex items-center gap-1 text-[11px] text-brand-blue-light/55">
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {h.court}
                      </span>
                    )}
                    {h.judge && (
                      <span className="flex items-center gap-1 text-[11px] text-brand-blue-light/55">
                        <User className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {h.judge}
                      </span>
                    )}
                    {h.purpose && (
                      <span className="flex items-center gap-1 text-[11px] text-brand-blue-light/55">
                        <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {h.purpose}
                      </span>
                    )}
                  </div>
                </div>

                <Calendar className="h-4 w-4 shrink-0 text-brand-gold/35 mt-0.5 group-hover:text-brand-gold/60 transition-colors" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
