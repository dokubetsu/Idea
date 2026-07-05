"use client";

import { Download } from "lucide-react";
import { Card, StatusPill } from "@/shared/components/ui";
import type { InvoiceClient } from "@/features/docket/types";

const STATUS_TONE: Record<string, "gold" | "teal" | "red" | "muted" | "blue"> = {
  draft: "muted",
  sent: "blue",
  paid: "teal",
  overdue: "red",
  cancelled: "muted",
};

interface Props {
  invoices: InvoiceClient[];
}

export function ClientInvoicesTable({ invoices }: Props) {
  if (invoices.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold mb-3">
          Your invoices
        </p>
        <p className="text-sm text-brand-blue-light/45">No invoices yet.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-brand-gold/8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
          Your invoices
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-brand-gold/8 bg-brand-gold/[0.02]">
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">Period</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">Work summary</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50 text-right">Amount</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-gold/6">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-brand-gold/4 transition-colors">
                <td className="px-4 py-3 text-xs text-brand-blue-light/55 whitespace-nowrap">
                  {inv.period_start && inv.period_end
                    ? `${new Date(inv.period_start).toLocaleDateString("en-IN", { month: "short" })} – ${new Date(inv.period_end).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-sm text-brand-blue-dark max-w-[200px] truncate">
                  {inv.work_summary ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-brand-blue-dark text-right font-mono">
                  ₹{inv.total_inr.toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3">
                  <StatusPill tone={STATUS_TONE[inv.status] ?? "muted"}>{inv.status}</StatusPill>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-brand-blue-light/30 hover:text-brand-gold hover:bg-brand-gold/8 transition-colors"
                    aria-label={`Download invoice ${inv.invoice_number}`}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
