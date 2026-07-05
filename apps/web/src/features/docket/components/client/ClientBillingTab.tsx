"use client";

import {
  IndianRupee,
  Receipt,
  CheckCircle,
  AlertCircle,
  CreditCard,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Card, Badge, StatusPill, Spinner, EmptyState, cn } from "@/shared/components/ui";
import { useCaseBilling } from "@/features/docket/hooks/useBilling";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface Props {
  matterId: string;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  period_start: string | null;
  period_end: string | null;
  total_inr: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  work_summary: string | null;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const GST_RATE = 0.18;

const STATUS_TONE: Record<string, "gold" | "teal" | "red" | "muted" | "blue"> = {
  draft: "muted",
  sent: "blue",
  paid: "teal",
  overdue: "red",
  cancelled: "muted",
};

/** Format amount using the Indian numbering system: ₹X,XX,XXX */
function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

/** Format a date string to a readable short format */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Generate a plain-text receipt and trigger a download */
function downloadReceipt(inv: InvoiceRow) {
  const baseAmount = Math.round(inv.total_inr / (1 + GST_RATE));
  const gstAmount = inv.total_inr - baseAmount;

  const receipt = [
    "════════════════════════════════════════════",
    "                  RECEIPT                   ",
    "════════════════════════════════════════════",
    "",
    `Receipt #:       ${inv.invoice_number}`,
    `Date:            ${formatDate(inv.paid_at)}`,
    "",
    "────────────────────────────────────────────",
    `Subtotal:        ${formatInr(baseAmount)}`,
    `GST (18%):       ${formatInr(gstAmount)}`,
    "────────────────────────────────────────────",
    `Total Paid:      ${formatInr(inv.total_inr)}`,
    "────────────────────────────────────────────",
    "",
    `Period:          ${inv.period_start && inv.period_end ? `${formatDate(inv.period_start)} – ${formatDate(inv.period_end)}` : "—"}`,
    `Work Summary:    ${inv.work_summary ?? "Professional services rendered"}`,
    "",
    "Payment confirmed ✓",
    "",
    "Thank you for your payment.",
    "",
    "════════════════════════════════════════════",
  ].join("\n");

  const blob = new Blob([receipt], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `receipt-${inv.invoice_number}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold mb-3">
      {children}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/*  Amount Due Hero                                                            */
/* -------------------------------------------------------------------------- */

function AmountDueHeroSection({
  amountDue,
  invoiceNumber,
  daysOverdue,
}: {
  amountDue: number;
  invoiceNumber: string | null;
  daysOverdue: number | null;
}) {
  if (amountDue <= 0) {
    return (
      <Card className="border-l-4 border-l-brand-teal p-5">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-6 w-6 text-brand-teal flex-shrink-0" />
          <div>
            <p className="text-lg font-semibold text-brand-blue-dark">
              All clear — nothing due right now
            </p>
            <p className="text-sm text-brand-blue-light/55 mt-0.5">
              You have no outstanding balance. We will notify you when your next invoice is ready.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const isOverdue = daysOverdue != null && daysOverdue > 0;

  return (
    <Card
      className={cn(
        "border-l-4 p-5",
        isOverdue ? "border-l-amber-500" : "border-l-brand-teal"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "p-2 rounded-xl",
              isOverdue ? "bg-amber-50" : "bg-brand-teal/10"
            )}
          >
            <IndianRupee
              className={cn(
                "h-6 w-6",
                isOverdue ? "text-amber-600" : "text-brand-teal"
              )}
            />
          </div>
          <div>
            <p className="text-2xl font-bold text-brand-blue-dark font-mono">
              {formatInr(amountDue)}
            </p>
            <p className="text-sm text-brand-blue-light/55 mt-0.5">
              Amount due
              {invoiceNumber && (
                <span className="ml-1 text-brand-blue-light/40">
                  · Invoice #{invoiceNumber}
                </span>
              )}
            </p>
          </div>
        </div>
        {isOverdue && (
          <Badge tone="gold" className="text-[9px] flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {daysOverdue} {daysOverdue === 1 ? "day" : "days"} overdue
          </Badge>
        )}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Fee Arrangement Explainer                                                  */
/* -------------------------------------------------------------------------- */

function FeeArrangementSection({
  feeDescription,
  retainerAmount,
  retainerUsed,
  engagementDocPath,
}: {
  feeDescription: string | null;
  retainerAmount: number | null;
  retainerUsed: number | null;
  engagementDocPath: string | null;
}) {
  const hasRetainer = retainerAmount != null && retainerAmount > 0;
  const usedAmount = retainerUsed ?? 0;
  const remainingBalance = hasRetainer ? retainerAmount - usedAmount : 0;
  const usagePercent = hasRetainer ? (usedAmount / retainerAmount) * 100 : 0;
  const isHighUsage = usagePercent > 80;

  return (
    <Card className="p-5">
      <SectionLabel>How you are billed</SectionLabel>

      {feeDescription && (
        <p className="text-sm text-brand-blue-dark leading-relaxed mb-4">
          {feeDescription}
        </p>
      )}

      {hasRetainer && (
        <div className="space-y-3">
          <p className="text-sm text-brand-blue-dark leading-relaxed">
            You paid a retainer of{" "}
            <span className="font-semibold">{formatInr(retainerAmount)}</span>.
            Your lawyer deducts fees from this balance. Current balance:{" "}
            <span className="font-semibold">{formatInr(remainingBalance)}</span>{" "}
            remaining.
          </p>

          {/* Retainer progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-brand-blue-light/50">
              <span>Used: {formatInr(usedAmount)}</span>
              <span>{Math.round(usagePercent)}% used</span>
            </div>
            <div className="h-2 w-full rounded-full bg-brand-gold/8 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  isHighUsage ? "bg-amber-500" : "bg-brand-teal"
                )}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {engagementDocPath && (
        <a
          href={engagementDocPath}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-brand-teal hover:text-brand-teal/80 mt-4 transition-colors"
          aria-label="View your fee agreement"
        >
          <FileText className="h-4 w-4" />
          View your fee agreement
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Summary Cards                                                              */
/* -------------------------------------------------------------------------- */

function SummaryCardsSection({
  paidToDate,
  amountDue,
  daysOverdue,
  retainerAmount,
  retainerUsed,
}: {
  paidToDate: number;
  amountDue: number;
  daysOverdue: number | null;
  retainerAmount: number | null;
  retainerUsed: number | null;
}) {
  const hasRetainer = retainerAmount != null && retainerAmount > 0;
  const remainingBalance = hasRetainer ? retainerAmount - (retainerUsed ?? 0) : null;
  const isOverdue = daysOverdue != null && daysOverdue > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {/* Total Paid */}
      <Card className="p-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-brand-teal/10">
            <CheckCircle className="h-4 w-4 text-brand-teal" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">
              Total Paid
            </p>
            <p className="text-lg font-bold text-brand-teal font-mono mt-0.5">
              {formatInr(paidToDate)}
            </p>
          </div>
        </div>
      </Card>

      {/* Amount Due */}
      <Card className="p-4">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "p-1.5 rounded-lg",
              isOverdue ? "bg-amber-50" : "bg-brand-gold/8"
            )}
          >
            <CreditCard
              className={cn(
                "h-4 w-4",
                isOverdue ? "text-amber-600" : "text-brand-blue-light/40"
              )}
            />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">
              Amount Due
            </p>
            <p
              className={cn(
                "text-lg font-bold font-mono mt-0.5",
                isOverdue ? "text-amber-600" : "text-brand-blue-dark"
              )}
            >
              {formatInr(amountDue)}
            </p>
          </div>
        </div>
      </Card>

      {/* Retainer Balance (conditional) */}
      {hasRetainer && remainingBalance != null && (
        <Card className="p-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-brand-gold/8">
              <IndianRupee className="h-4 w-4 text-brand-gold" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">
                Retainer Balance
              </p>
              <p className="text-lg font-bold text-brand-blue-dark font-mono mt-0.5">
                {formatInr(remainingBalance)}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Invoice History                                                            */
/* -------------------------------------------------------------------------- */

function InvoiceHistorySection({ invoices }: { invoices: InvoiceRow[] }) {
  if (invoices.length === 0) {
    return (
      <Card className="p-5">
        <SectionLabel>Invoice history</SectionLabel>
        <p className="text-sm text-brand-blue-light/45">No invoices yet.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-brand-gold/8">
        <SectionLabel>Invoice history</SectionLabel>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-brand-gold/8 bg-brand-gold/[0.02]">
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">
                Period
              </th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">
                Work summary
              </th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50 text-right">
                Amount
              </th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">
                Status
              </th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">
                Due / Paid
              </th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-gold/6">
            {invoices.map((inv) => {
              const isPaid = inv.status === "paid";
              const isOverdue = inv.status === "overdue";

              return (
                <tr
                  key={inv.id}
                  className="hover:bg-brand-gold/4 transition-colors"
                >
                  <td className="px-4 py-3 text-xs text-brand-blue-light/55 whitespace-nowrap">
                    {inv.period_start && inv.period_end
                      ? `${new Date(inv.period_start).toLocaleDateString("en-IN", { month: "short" })} – ${new Date(inv.period_end).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-brand-blue-dark max-w-[220px] truncate">
                    {inv.work_summary ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-brand-blue-dark text-right font-mono">
                    {formatInr(inv.total_inr)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={STATUS_TONE[inv.status] ?? "muted"}>
                      {inv.status}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-blue-light/55 whitespace-nowrap">
                    {isPaid
                      ? `Paid ${formatDate(inv.paid_at)}`
                      : inv.due_date
                        ? `Due by ${formatDate(inv.due_date)}`
                        : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {isPaid ? (
                      <button
                        type="button"
                        onClick={() => downloadReceipt(inv)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-brand-teal hover:bg-brand-teal/8 transition-colors"
                        aria-label={`Download receipt for invoice ${inv.invoice_number}`}
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        Receipt
                      </button>
                    ) : isOverdue ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                        <AlertCircle className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Transparency Note                                                          */
/* -------------------------------------------------------------------------- */

function TransparencyNote() {
  return (
    <Card className="p-4 bg-brand-gold/[0.02]">
      <p className="text-xs text-brand-blue-light/50 leading-relaxed">
        All charges include 18% GST as applicable. For questions about your
        bill, message your lawyer directly via the{" "}
        <span className="text-brand-teal font-medium">Messages</span> tab.
      </p>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main Component                                                             */
/* -------------------------------------------------------------------------- */

export default function ClientBillingTab({ matterId }: Props) {
  const { data, isLoading } = useCaseBilling(matterId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={Receipt}
        title="No billing information"
        body="Billing details will appear here once your lawyer sets up the fee arrangement."
      />
    );
  }

  // Type guard: ensure we're working with client billing data
  const billing = data as import("@/features/docket/types").ClientBilling;

  return (
    <div className="space-y-5">
      {/* 1. Amount Due Hero */}
      <AmountDueHeroSection
        amountDue={billing.amount_due}
        invoiceNumber={billing.amount_due_invoice}
        daysOverdue={billing.days_overdue}
      />

      {/* 2. Fee Arrangement Explainer */}
      <FeeArrangementSection
        feeDescription={billing.fee_description}
        retainerAmount={billing.retainer_amount}
        retainerUsed={billing.retainer_used}
        engagementDocPath={billing.engagement_doc_path}
      />

      {/* 3. Summary Cards */}
      <SummaryCardsSection
        paidToDate={billing.paid_to_date}
        amountDue={billing.amount_due}
        daysOverdue={billing.days_overdue}
        retainerAmount={billing.retainer_amount}
        retainerUsed={billing.retainer_used}
      />

      {/* 4. Invoice History */}
      <InvoiceHistorySection invoices={billing.invoices} />

      {/* 5. Transparency Note */}
      <TransparencyNote />
    </div>
  );
}
