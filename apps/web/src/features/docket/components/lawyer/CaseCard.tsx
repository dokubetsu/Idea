"use client";

import Link from "next/link";
import { Calendar, AlertTriangle, Activity } from "lucide-react";
import { Card, StatusPill, Badge, cn } from "@/shared/components/ui";
import type { CaseCard as CaseCardType } from "@/features/docket/types";

const STAGE_TONE: Record<string, "gold" | "teal" | "blue" | "muted" | "red"> = {
  filed: "gold",
  reply: "gold",
  evidence: "blue",
  arguments: "teal",
  judgment: "teal",
  active: "teal",
  matching: "blue",
  intake: "muted",
  assessment: "muted",
  draft: "muted",
  resolved: "gold",
  closed: "muted",
  appeal: "blue",
  archived: "muted",
};

const HEALTH_TONE: Record<string, "teal" | "gold" | "red" | "muted"> = {
  good: "teal",
  fair: "gold",
  critical: "red",
  unknown: "muted",
};

interface Props {
  caseData: CaseCardType;
}

export function CaseCard({ caseData }: Props) {
  const monogram = caseData.client_name.trim().charAt(0).toUpperCase();
  const stageTone = STAGE_TONE[caseData.stage.toLowerCase()] ?? "muted";
  const healthTone = caseData.matter_health
    ? (HEALTH_TONE[caseData.matter_health.toLowerCase()] ?? "muted")
    : null;

  return (
    <Link
      href={`/lawyer/matters/${caseData.id}`}
      className="group block rounded-xl border border-brand-gold/12 bg-base-100 p-5 shadow-sm transition-all duration-200 hover:border-brand-gold/25 hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
      aria-label={`Case: ${caseData.case_name}, client: ${caseData.client_name}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Client monogram */}
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-gold/20 bg-brand-gold/10 font-serif text-base font-bold text-brand-gold"
            aria-hidden="true"
          >
            {monogram}
          </span>
          <div className="min-w-0">
            <p className="font-serif text-base font-bold text-brand-blue-dark line-clamp-1">
              {caseData.client_name}
            </p>
            <p className="mt-0.5 text-[12px] text-brand-blue-light/55 line-clamp-1">
              {caseData.case_name}
            </p>
          </div>
        </div>
        {caseData.is_urgent && (
          <Badge tone="red" className="shrink-0">
            <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
            urgent
          </Badge>
        )}
      </div>

      {/* Stage + category */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusPill tone={stageTone}>{caseData.stage}</StatusPill>
        {caseData.category && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-blue-light/40">
            {caseData.category}
          </span>
        )}
      </div>

      {/* Footer row */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-brand-gold/8 pt-3">
        {caseData.next_hearing_countdown ? (
          <span className="flex items-center gap-1.5 text-[11px] text-brand-blue-light/55">
            <Calendar className="h-3.5 w-3.5 text-brand-gold/60 shrink-0" aria-hidden="true" />
            <span className="font-semibold text-brand-blue-dark">
              {caseData.next_hearing_countdown}
            </span>
          </span>
        ) : (
          <span className="text-[11px] text-brand-blue-light/35">No hearing set</span>
        )}

        {healthTone && caseData.matter_health && (
          <span
            className={cn(
              "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
              healthTone === "teal" && "text-brand-teal",
              healthTone === "gold" && "text-brand-gold",
              healthTone === "red" && "text-red-500",
              healthTone === "muted" && "text-brand-blue-light/35",
            )}
            aria-label={`Matter health: ${caseData.matter_health}`}
          >
            <Activity className="h-3 w-3" aria-hidden="true" />
            {caseData.matter_health}
          </span>
        )}
      </div>

      {caseData.case_number && (
        <p className="mt-2 font-mono text-[10px] text-brand-blue-light/30">
          {caseData.case_number}
        </p>
      )}
    </Link>
  );
}
