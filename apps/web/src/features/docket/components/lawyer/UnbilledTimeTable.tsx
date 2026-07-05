"use client";

import { Card, StatusPill, cn } from "@/shared/components/ui";
import type { TimeEntry } from "@/features/docket/types";

interface Props {
  entries: TimeEntry[];
}

export function UnbilledTimeTable({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold mb-3">
          Unbilled time
        </p>
        <p className="text-sm text-brand-blue-light/45">No unbilled time entries.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-brand-gold/8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
          Unbilled time
        </p>
        <span className="text-xs text-brand-blue-light/45">
          {entries.length} entr{entries.length === 1 ? "y" : "ies"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-brand-gold/8 bg-brand-gold/[0.02]">
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">Date</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">Activity</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50 text-right">Hours</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50 text-right">Amount</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-gold/6">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-brand-gold/4 transition-colors">
                <td className="px-4 py-3 text-xs text-brand-blue-light/55 whitespace-nowrap">
                  {new Date(entry.entry_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </td>
                <td className="px-4 py-3 text-sm text-brand-blue-dark max-w-[200px] truncate">
                  {entry.activity}
                </td>
                <td className="px-4 py-3 text-sm text-brand-blue-dark text-right font-mono">
                  {entry.hours.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-sm text-brand-blue-dark text-right font-mono">
                  {entry.amount_inr ? `₹${entry.amount_inr.toLocaleString("en-IN")}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusPill tone="gold">{entry.status}</StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
