"use client";

import { Card, cn } from "@/shared/components/ui";
import type { LawyerBilling } from "@/features/docket/types";

function formatInr(amount: number): string {
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)}L`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

interface Props {
  billing: LawyerBilling;
}

export function BillingKpis({ billing }: Props) {
  const kpis = [
    { label: "Unbilled WIP", value: formatInr(billing.unbilled_wip), tone: "default" },
    { label: "Billed (AR)", value: formatInr(billing.billed_ar), tone: billing.has_overdue ? "warning" : "default" },
    { label: "Paid to date", value: formatInr(billing.paid_to_date), tone: "success" },
    { label: "Trust balance", value: formatInr(billing.trust_balance), tone: "default" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue-light/50">
            {kpi.label}
          </p>
          <p
            className={cn(
              "mt-1 font-serif text-2xl font-bold",
              kpi.tone === "warning" && "text-amber-600",
              kpi.tone === "success" && "text-brand-teal",
              kpi.tone === "default" && "text-brand-blue-dark"
            )}
          >
            {kpi.value}
          </p>
        </Card>
      ))}
    </div>
  );
}
