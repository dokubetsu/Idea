"use client";

import { CalculatorsView } from "@/features/legal-tools/components/CalculatorsView";

export default function LawyerLegalToolsPage() {
  return (
    <div className="animate-fade-in-up space-y-7">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">Advocate Tools & Calculators</p>
        <h1 className="mt-1 font-serif text-4xl font-bold">India Legal Calculators.</h1>
        <p className="mt-1.5 text-sm text-brand-blue-light/55">
          Verify Section 138 NI Act filing deadlines, RERA delayed interest, and Civil Suit limitations.
        </p>
      </div>
      <CalculatorsView />
    </div>
  );
}
