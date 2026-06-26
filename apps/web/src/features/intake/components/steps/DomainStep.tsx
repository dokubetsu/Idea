"use client";

import { ChevronRight } from "lucide-react";
import { DOMAINS } from "../intakeConstants";

interface DomainStepProps {
  onDomainSelect: (domainId: string) => void;
}

export function DomainStep({ onDomainSelect }: DomainStepProps) {
  return (
    <div className="p-6 space-y-4">
      <p className="text-sm text-brand-blue-light/60">
        Choose the legal domain that your case falls under. Selecting Legal Notice will open the drafting tool.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {DOMAINS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onDomainSelect(d.id)}
            className="flex flex-col gap-2 rounded-xl border border-brand-gold/12 bg-base-100 p-4 text-left transition-all hover:border-brand-gold/35 hover:bg-brand-gold/5 hover:-translate-y-0.5 hover:shadow-sm group"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">{d.icon}</span>
              <ChevronRight className="h-4 w-4 text-brand-blue-light/20 group-hover:text-brand-gold transition-colors" />
            </div>
            <p className="font-semibold text-[13px] text-brand-blue-dark">{d.label}</p>
            <p className="text-[11px] text-brand-blue-light/50 leading-4">{d.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
