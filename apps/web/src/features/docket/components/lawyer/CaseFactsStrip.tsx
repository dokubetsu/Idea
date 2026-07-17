"use client";

import { Card } from "@/shared/components/ui";

interface Plaintiff {
  name: string;
  contact?: {
    phone?: string | null;
    city?: string | null;
  } | null;
}

interface CaseFacts {
  case_number: string | null;
  court: string | null;
  category: string;
  filed_date: string | null;
  wip: number;
  plaintiff: Plaintiff;
}

interface CaseFactsStripProps {
  facts: CaseFacts;
}

export default function CaseFactsStrip({ facts }: CaseFactsStripProps) {
  const formattedWip = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(facts.wip);

  return (
    <Card className="rounded-xl border border-brand-gold/12 bg-base-100 shadow-sm p-4">
      {/* Row 1: Case metadata */}
      <div className="grid grid-cols-5 gap-4">
        <div>
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground font-sans">
            Case no.
          </span>
          <span className="block text-[11px] font-sans text-foreground mt-0.5">
            {facts.case_number}
          </span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground font-sans">
            Court
          </span>
          <span className="block text-[11px] font-sans text-foreground mt-0.5">
            {facts.court}
          </span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground font-sans">
            Type
          </span>
          <span className="block text-[11px] font-sans text-foreground mt-0.5">
            {facts.category}
          </span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground font-sans">
            Filed date
          </span>
          <span className="block text-[11px] font-sans text-foreground mt-0.5">
            {facts.filed_date}
          </span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground font-sans">
            WIP
          </span>
          <span className="block text-[11px] font-sans text-foreground mt-0.5">
            {formattedWip}
          </span>
        </div>
      </div>

      {/* Dashed divider */}
      <div className="border-t border-dashed border-brand-gold/12 my-3" />

      {/* Row 2: Parties */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground font-sans">
            Plaintiff
          </span>
          <span className="block text-[11px] font-sans text-foreground mt-0.5">
            {facts.plaintiff.name}
          </span>
          <span className="block text-[11px] font-sans text-muted-foreground">
            {[facts.plaintiff.contact?.phone, facts.plaintiff.contact?.city]
              .filter(Boolean)
              .join(" • ")}
          </span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground font-sans">
            Defendant
          </span>
          <span className="block text-[11px] font-sans text-foreground mt-0.5">
            &mdash;
          </span>
        </div>
      </div>
    </Card>
  );
}
