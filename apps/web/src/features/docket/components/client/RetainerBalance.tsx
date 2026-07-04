"use client";

import { Card, cn } from "@/shared/components/ui";

interface Props {
  retainerAmount: number | null;
  retainerUsed: number | null;
  paidToDate: number;
}

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function RetainerBalance({ retainerAmount, retainerUsed, paidToDate }: Props) {
  const hasRetainer = retainerAmount !== null && retainerAmount > 0;
  const usagePercent = hasRetainer
    ? Math.min(100, Math.round(((retainerUsed ?? 0) / retainerAmount!) * 100))
    : 0;
  const remaining = hasRetainer ? retainerAmount! - (retainerUsed ?? 0) : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Retainer card */}
      {hasRetainer && (
        <Card className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue-light/50">
            Retainer balance
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-brand-blue-dark">
            {formatInr(remaining)}
          </p>
          <div className="mt-3">
            <div className="h-2 w-full rounded-full bg-base-300 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  usagePercent > 80 ? "bg-amber-500" : "bg-brand-teal"
                )}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-brand-blue-light/40">
              <span>{formatInr(retainerUsed ?? 0)} used</span>
              <span>{formatInr(retainerAmount!)} total</span>
            </div>
          </div>
        </Card>
      )}

      {/* Paid to date */}
      <Card className="p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue-light/50">
          Paid to date
        </p>
        <p className="mt-1 font-serif text-2xl font-bold text-brand-teal">
          {formatInr(paidToDate)}
        </p>
        <p className="mt-1 text-xs text-brand-blue-light/40">Total payments made</p>
      </Card>
    </div>
  );
}
