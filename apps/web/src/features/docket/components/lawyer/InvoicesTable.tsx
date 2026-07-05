"use client";

import { Card, StatusPill } from "@/shared/components/ui";
import type { Invoice } from "@/features/docket/types";

const STATUS_TONE: Record<string, "gold" | "teal" | "red" | "muted" | "blue"> = {
  draft: "muted",
  sent: "blue",
  paid: "teal",
  overdue: "red",
  cancelled: "muted",
};

interface Props {
  invoices: Invoice[];
}

export function InvoicesTable({ invoices }: Props) {
  if (invoices.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold mb-3">
          Invoices
        </p>
        <p className="text-sm text-brand-blue-light/45">No invoices yet.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-brand-gold/8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
          Invoices
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-brand-gold/8 bg-brand-gold/[0.02]">
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">Number</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">Period</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50 text-right">Amount</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-gold/6">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-brand-gold/4 transition-colors">
                <td className="px-4 py-3 text-sm font-semibold text-brand-blue-dark font-mono">
                  {inv.invoice_number}
                </td>
                <td className="px-4 py-3 text-xs text-brand-blue-light/55">
                  {inv.period_start && inv.period_end
                    ? `${new Date(inv.period_start).toLocaleDateString("en-IN", { month: "short" })} – ${new Date(inv.period_end).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-brand-blue-dark text-right font-mono">
                  ₹{inv.total_inr.toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3">
                  <StatusPill tone={STATUS_TONE[inv.status] ?? "muted"}>{inv.status}</StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
