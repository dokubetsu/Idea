"use client";

import { Card } from "@/shared/components/ui";
import type { Disbursement } from "@/features/docket/types";

interface Props {
  disbursements: Disbursement[];
}

export function DisbursementsList({ disbursements }: Props) {
  if (disbursements.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold mb-3">
          Disbursements
        </p>
        <p className="text-sm text-brand-blue-light/45">No disbursements recorded.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-brand-gold/8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
          Disbursements
        </p>
      </div>
      <div className="divide-y divide-brand-gold/6">
        {disbursements.map((d) => (
          <div key={d.id} className="flex items-center justify-between px-5 py-3">
            <div>
              <p className="text-sm text-brand-blue-dark">{d.description}</p>
              <p className="text-[11px] text-brand-blue-light/40">
                {new Date(d.incurred_on).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            <p className="text-sm font-semibold text-brand-blue-dark font-mono shrink-0">
              ₹{d.amount_inr.toLocaleString("en-IN")}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
