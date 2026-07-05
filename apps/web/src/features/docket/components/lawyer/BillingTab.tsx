"use client";

import { useState } from "react";
import {
  Receipt,
  Download,
  IndianRupee,
  CreditCard,
  FileText,
  Plus,
} from "lucide-react";
import { Card, Button, Badge, StatusPill, Spinner, EmptyState, cn } from "@/shared/components/ui";
import { useCaseBilling, useCreateInvoice, useUpdateInvoice } from "@/features/docket/hooks/useBilling";
import { BillingKpis } from "./BillingKpis";
import { UnbilledTimeTable } from "./UnbilledTimeTable";
import { InvoicesTable } from "./InvoicesTable";
import { DisbursementsList } from "./DisbursementsList";
import type { LawyerBilling, Invoice } from "@/features/docket/types";

// ── Helpers ────────────────────────────────────────────────────────

/** Format number in Indian ₹X,XX,XXX style */
function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function generateReceiptBlob(invoice: Invoice, matterTitle: string): Blob {
  const subtotal = invoice.subtotal_inr;
  const gst = invoice.gst_amount_inr;
  const total = invoice.total_inr;

  const receiptText = [
    "═══════════════════════════════════════════════════",
    "                   PAYMENT RECEIPT                 ",
    "═══════════════════════════════════════════════════",
    "",
    `Receipt No:       RCT-${invoice.invoice_number}`,
    `Date:             ${formatDate(invoice.paid_at || new Date().toISOString())}`,
    `Client:           ${matterTitle}`,
    `Invoice No:       ${invoice.invoice_number}`,
    "",
    "───────────────────────────────────────────────────",
    "  AMOUNT DETAILS",
    "───────────────────────────────────────────────────",
    "",
    `  Subtotal:       ${formatInr(subtotal)}`,
    `  GST (${invoice.gst_percent}%):     ${formatInr(gst)}`,
    "  ───────────────────────────────────────",
    `  Total Paid:     ${formatInr(total)}`,
    "",
    "───────────────────────────────────────────────────",
    "",
    "  Payment Status: PAID",
    `  Paid Date:      ${invoice.paid_at ? formatDate(invoice.paid_at) : "N/A"}`,
    "",
    "═══════════════════════════════════════════════════",
    "  This is a computer-generated receipt.",
    "  No signature is required.",
    "═══════════════════════════════════════════════════",
  ].join("\n");

  return new Blob([receiptText], { type: "text/plain;charset=utf-8" });
}

// ── Props ──────────────────────────────────────────────────────────

interface Props {
  matterId: string;
}

// ── Component ──────────────────────────────────────────────────────

export default function BillingTab({ matterId }: Props) {
  const { data: billing, isLoading, isError } = useCaseBilling(matterId);
  const createInvoice = useCreateInvoice(matterId);
  const updateInvoice = useUpdateInvoice(matterId);

  const [workSummary, setWorkSummary] = useState("");

  // ── Loading & empty states ─────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (isError || !billing) {
    return (
      <EmptyState
        icon={IndianRupee}
        title="Billing unavailable"
        body="Could not load billing data for this matter."
      />
    );
  }

  // Guard: ensure this is a LawyerBilling response
  if (billing.role !== "lawyer") {
    return (
      <EmptyState
        icon={IndianRupee}
        title="Access restricted"
        body="Lawyer billing view is not available for this role."
      />
    );
  }

  const lawyerBilling = billing as LawyerBilling;

  // ── Handlers ───────────────────────────────────────────────────

  const totalUnbilled = lawyerBilling.unbilled_entries.reduce(
    (sum, e) => sum + (e.amount_inr ?? 0),
    0
  );

  const handleCreateInvoice = () => {
    const timeEntryIds = lawyerBilling.unbilled_entries.map((e) => e.id);
    if (timeEntryIds.length === 0) return;
    createInvoice.mutate({
      time_entry_ids: timeEntryIds,
      work_summary: workSummary.trim() || undefined,
    });
    setWorkSummary("");
  };

  const handleMarkSent = (invoiceId: string) => {
    updateInvoice.mutate({ invoiceId, status: "sent" });
  };

  const handleMarkPaid = (invoiceId: string) => {
    updateInvoice.mutate({ invoiceId, status: "paid" });
  };

  const handleDownloadReceipt = (invoice: Invoice) => {
    const blob = generateReceiptBlob(invoice, `Matter ${matterId}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${invoice.invoice_number}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* 1. Fee Arrangement Card */}
      {lawyerBilling.fee_arrangement && (
        <Card className="border-l-4 border-l-brand-gold/60 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold mb-2">
                Fee arrangement
              </p>
              <div className="flex items-center gap-2 mb-1">
                <Badge tone="gold">
                  {lawyerBilling.fee_arrangement.type}
                </Badge>
                {lawyerBilling.fee_arrangement.rate_per_hour != null && (
                  <span className="text-sm font-mono text-brand-blue-dark">
                    {formatInr(lawyerBilling.fee_arrangement.rate_per_hour)}/hr
                  </span>
                )}
                {lawyerBilling.fee_arrangement.fixed_amount != null && (
                  <span className="text-sm font-mono text-brand-blue-dark">
                    Fixed: {formatInr(lawyerBilling.fee_arrangement.fixed_amount)}
                  </span>
                )}
              </div>
              {lawyerBilling.fee_arrangement.description && (
                <p className="text-xs text-brand-blue-light/55 mt-1">
                  {lawyerBilling.fee_arrangement.description}
                </p>
              )}
            </div>
            <CreditCard className="h-5 w-5 text-brand-gold/40 shrink-0" />
          </div>

          {/* Retainer progress bar */}
          {lawyerBilling.fee_arrangement.type === "retainer" &&
            lawyerBilling.fee_arrangement.retainer_amount != null &&
            lawyerBilling.fee_arrangement.retainer_used != null && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-brand-blue-light/55 mb-1.5">
                  <span>Retainer used</span>
                  <span className="font-mono">
                    {formatInr(lawyerBilling.fee_arrangement.retainer_used)} /{" "}
                    {formatInr(lawyerBilling.fee_arrangement.retainer_amount)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-brand-gold/10 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      (lawyerBilling.fee_arrangement.retainer_used /
                        lawyerBilling.fee_arrangement.retainer_amount) > 0.85
                        ? "bg-red-500"
                        : "bg-brand-gold"
                    )}
                    style={{
                      width: `${Math.min(
                        100,
                        (lawyerBilling.fee_arrangement.retainer_used /
                          lawyerBilling.fee_arrangement.retainer_amount) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}
        </Card>
      )}

      {/* 2. Billing KPIs */}
      <BillingKpis billing={lawyerBilling} />

      {/* 3. Generate Invoice Section */}
      <Card className="border border-brand-gold/30 p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4 text-brand-gold" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
            Generate invoice
          </p>
        </div>

        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1.5 text-sm text-brand-blue-dark">
            <Receipt className="h-4 w-4 text-brand-blue-light/40" />
            <span>
              <strong className="font-mono">{lawyerBilling.unbilled_entries.length}</strong>{" "}
              unbilled {lawyerBilling.unbilled_entries.length === 1 ? "entry" : "entries"}
            </span>
          </div>
          <div className="text-sm font-semibold text-brand-blue-dark font-mono">
            Total: {formatInr(totalUnbilled)}
          </div>
        </div>

        <textarea
          value={workSummary}
          onChange={(e) => setWorkSummary(e.target.value)}
          placeholder="Work summary for the invoice (optional)..."
          rows={3}
          className="w-full rounded-xl border border-brand-gold/15 bg-base-100 px-3.5 py-3 text-[13px] text-brand-blue-dark outline-none transition-all duration-200 placeholder:text-brand-blue-light/30 focus:border-brand-gold focus:bg-white focus:shadow-sm resize-none mb-3"
          aria-label="Work summary for invoice"
        />

        <Button
          variant="gold"
          size="md"
          onClick={handleCreateInvoice}
          disabled={createInvoice.isPending || lawyerBilling.unbilled_entries.length === 0}
          aria-label="Generate invoice"
        >
          <Plus className="h-4 w-4" />
          Generate Invoice
        </Button>

        {/* Show newly created invoice details */}
        {createInvoice.isSuccess && !!createInvoice.data && (
          <div className="mt-4 rounded-lg border border-brand-teal/20 bg-brand-teal/5 p-3">
            <p className="text-xs font-semibold text-brand-teal mb-1">
              Invoice created successfully
            </p>
            <div className="grid grid-cols-3 gap-2 text-[11px] text-brand-blue-dark">
              <div>
                <span className="text-brand-blue-light/50">Invoice #:</span>{" "}
                <span className="font-mono font-semibold">
                  {(createInvoice.data as any).invoice_number ?? "—"}
                </span>
              </div>
              <div>
                <span className="text-brand-blue-light/50">Subtotal:</span>{" "}
                <span className="font-mono">
                  {formatInr((createInvoice.data as any).subtotal_inr ?? 0)}
                </span>
              </div>
              <div>
                <span className="text-brand-blue-light/50">GST (18%):</span>{" "}
                <span className="font-mono">
                  {formatInr((createInvoice.data as any).gst_amount_inr ?? 0)}
                </span>
              </div>
            </div>
            <p className="mt-1 text-[11px] font-semibold text-brand-blue-dark font-mono">
              Total: {formatInr((createInvoice.data as any).total_inr ?? 0)}
            </p>
          </div>
        )}
      </Card>

      {/* 4. Unbilled Time Table */}
      <UnbilledTimeTable entries={lawyerBilling.unbilled_entries} />

      {/* 5. Invoices Table with Action Buttons */}
      <div>
        <InvoicesTable invoices={lawyerBilling.invoices} />

        {/* Invoice action rows */}
        {lawyerBilling.invoices.length > 0 && (
          <Card className="mt-2 overflow-hidden">
            <div className="px-5 py-3 border-b border-brand-gold/8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
                Invoice actions
              </p>
            </div>
            <div className="divide-y divide-brand-gold/6">
              {lawyerBilling.invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-semibold text-brand-blue-dark">
                      {inv.invoice_number}
                    </span>
                    <StatusPill
                      tone={
                        inv.status === "paid"
                          ? "teal"
                          : inv.status === "overdue"
                          ? "red"
                          : inv.status === "sent"
                          ? "blue"
                          : "muted"
                      }
                    >
                      {inv.status}
                    </StatusPill>
                  </div>
                  <div className="flex items-center gap-2">
                    {inv.status === "draft" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleMarkSent(inv.id)}
                        disabled={updateInvoice.isPending}
                        aria-label={`Mark invoice ${inv.invoice_number} as sent`}
                      >
                        Mark Sent
                      </Button>
                    )}
                    {(inv.status === "sent" || inv.status === "overdue") && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleMarkPaid(inv.id)}
                        disabled={updateInvoice.isPending}
                        aria-label={`Mark invoice ${inv.invoice_number} as paid`}
                      >
                        Mark Paid
                      </Button>
                    )}
                    {inv.status === "paid" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadReceipt(inv)}
                        aria-label={`Download receipt for invoice ${inv.invoice_number}`}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download Receipt
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* 6. Disbursements List */}
      <DisbursementsList disbursements={lawyerBilling.disbursements} />
    </div>
  );
}
