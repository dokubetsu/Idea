"use client";

import { ArrowLeft } from "lucide-react";
import { DOMAINS, CategoryId } from "../intakeConstants";

interface SubtypeStepProps {
  selectedDomain: string;
  onSubtypeSelect: (subtypeId: CategoryId) => void;
  onBack: () => void;
}

export function SubtypeStep({ selectedDomain, onSubtypeSelect, onBack }: SubtypeStepProps) {
  const currentDomainObj = DOMAINS.find((d) => d.id === selectedDomain);

  if (!currentDomainObj) return null;

  return (
    <div className="p-6 space-y-4">
      <p className="text-sm text-brand-blue-light/60">
        Select the specific sub-type that best matches your situation.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {currentDomainObj.subtypes.map((sub) => (
          <button
            key={sub.id}
            type="button"
            onClick={() => onSubtypeSelect(sub.id as CategoryId)}
            className="flex flex-col gap-1 rounded-xl border border-brand-gold/12 bg-base-100 p-4 text-left transition-all hover:border-brand-gold/35 hover:bg-brand-gold/5 hover:-translate-y-0.5 hover:shadow-sm"
          >
            <p className="font-semibold text-[13px] text-brand-blue-dark">{sub.label}</p>
            <p className="text-[11px] text-brand-blue-light/50 leading-4">{sub.desc}</p>
          </button>
        ))}
      </div>
      <div className="flex pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-brand-gold/15 px-4 py-2 text-sm font-medium text-brand-blue-light/60 hover:bg-base-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Domains
        </button>
      </div>
    </div>
  );
}
