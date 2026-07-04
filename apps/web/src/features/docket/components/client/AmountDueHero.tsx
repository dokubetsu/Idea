"use client";

import { CheckCircle, Receipt } from "lucide-react";
import { Card, Button, cn } from "@/shared/components/ui";

function formatInr(amount: number): string {
  // Indian lakhs format
  if (amount >= 100000) {
    const lakhs = amount / 100000;
    return `₹${lakhs.toFixed(2).replace(/\.00$/, "")} lakh`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

interface Props {
  amountDue: number;
  invoiceNumber: string | null;
  daysOverdue: number | null;
}

export function AmountDueHero({ amountDue, invoiceNumber, daysOverdue }: Props) {
  // Empty state: no amount due — show calm "all clear" card
  if (amountDue <= 0) {
    return (
      <Card className="p-6 border-l-4 border-l-brand-teal">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10">
            <CheckCircle className="h-5 w-5 text-brand-teal" />
          </div>
          <div>
            <p className="font-serif text-lg font-bold text-brand-teal">All clear</p>
            <p className="text-sm text-brand-blue-light/55">No outstanding balance. You&apos;re up to date.</p>
          </div>
        </div>
      </Card>
    );
  }

  // Amount due hero — amber warning treatment
  return (
    <Card className="overflow-hidden bg-amber-50 border-amber-200">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
              Amount due
            </p>
            <p className="mt-1 font-serif text-4xl font-bold text-amber-900">
              {formatInr(amountDue)}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-amber-700">
              {invoiceNumber && <span>{invoiceNumber}</span>}
              {daysOverdue && daysOverdue > 0 && (
                <>
                  <span>·</span>
                  <span className="font-semibold">{daysOverdue} days overdue</span>
                </>
              )}
            </div>
          </div>
          <Button variant="primary" size="md" aria-label="Pay now">
            <Receipt className="h-4 w-4" />
            Pay now
          </Button>
        </div>
      </div>
    </Card>
  );
}
