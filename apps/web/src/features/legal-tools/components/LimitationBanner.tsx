"use client";

import { useEffect, useState } from "react";
import { CircleCheck, CircleAlert, CircleX, Loader2 } from "lucide-react";
import { apiClient } from "@/shared/lib/api/client";
import type { Fact, MatterCategory } from "@/entities/types";

interface LimitationBannerProps {
  category: MatterCategory;
  facts: Fact[];
}

interface CalculationResult {
  status: "safe" | "action_required" | "expired";
  reason: string;
  color: "green" | "yellow" | "red";
  days_remaining?: number;
  filing_deadline?: string;
  [key: string]: unknown;
}


export const EMPTY_FACTS: Fact[] = [];

export function LimitationBanner({ category, facts }: LimitationBannerProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CalculationResult | null>(null);

  const factsJson = JSON.stringify(facts.map((f) => ({ key: f.key, value: f.value })));

  useEffect(() => {
    let active = true;

    async function calculateTimeline() {
      // 1. Cheque Bounce Category
      if (category === "cheque_bounce") {
        const chequeDate = facts.find((f) => f.key === "cheque_date")?.value;
        const dishonourDate = facts.find((f) => f.key === "dishonour_date")?.value;
        const noticeDate = facts.find((f) => f.key === "notice_date")?.value;
        const noticeReceiptDate = facts.find((f) => f.key === "notice_receipt_date")?.value;
        const complaintFiledDate = facts.find((f) => f.key === "complaint_filed_date")?.value;

        if (!chequeDate || !dishonourDate) return;

        setLoading(true);
        try {
          const res = await apiClient.post<CalculationResult>("/legal-tools/calculators/cheque-bounce", {
            cheque_date: chequeDate,
            dishonour_date: dishonourDate,
            notice_date: noticeDate || null,
            notice_receipt_date: noticeReceiptDate || null,
            complaint_filed_date: complaintFiledDate || null,
          });
          if (active) setResult(res);
        } catch (err) {
          console.error("Failed to calculate cheque bounce timelines:", err);
        } finally {
          if (active) setLoading(false);
        }
      }
      // 2. RERA Category
      else if (category === "rera") {
        const paidAmountVal = facts.find((f) => f.key === "total_paid_amount")?.value;
        const promisedDate = facts.find((f) => f.key === "promised_possession_date")?.value;
        const actualDate = facts.find((f) => f.key === "actual_possession_date")?.value;
        const customRateVal = facts.find((f) => f.key === "custom_interest_rate")?.value;

        if (!promisedDate || !paidAmountVal) return;

        const totalPaidAmount = parseFloat(paidAmountVal.replace(/[^0-9.]/g, ""));
        if (isNaN(totalPaidAmount) || totalPaidAmount <= 0) return;

        setLoading(true);
        try {
          const res = await apiClient.post<CalculationResult>("/legal-tools/calculators/rera", {
            total_paid_amount: totalPaidAmount,
            promised_possession_date: promisedDate,
            actual_possession_date: actualDate || null,
            custom_interest_rate: customRateVal ? parseFloat(customRateVal) : null,
          });
          if (active) setResult(res);
        } catch (err) {
          console.error("Failed to calculate RERA delay interest:", err);
        } finally {
          if (active) setLoading(false);
        }
      }
      // 3. Check for general Debt Recovery / Summary Suit (CPC Order 37) if facts match
      else {
        const claimAmountVal = facts.find((f) => f.key === "claim_amount" || f.key === "cheque_amount")?.value;
        const dueDate = facts.find((f) => f.key === "due_date" || f.key === "cheque_date")?.value;
        const state = facts.find((f) => f.key === "state" || f.key === "jurisdiction_state")?.value || "default";

        if (!claimAmountVal || !dueDate) return;

        const claimAmount = parseFloat(claimAmountVal.replace(/[^0-9.]/g, ""));
        if (isNaN(claimAmount) || claimAmount <= 0) return;

        setLoading(true);
        try {
          const res = await apiClient.post<CalculationResult>("/legal-tools/calculators/summary-suit", {
            claim_amount: claimAmount,
            due_date: dueDate,
            state: state,
          });
          if (active) setResult(res);
        } catch (err) {
          console.error("Failed to calculate summary suit limitation:", err);
        } finally {
          if (active) setLoading(false);
        }
      }
    }

    calculateTimeline();

    return () => {
      active = false;
    };
  }, [category, factsJson]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-brand-gold/15 bg-brand-blue-dark/5 p-4 text-xs text-brand-blue-light/60">
        <Loader2 className="h-4 w-4 animate-spin text-brand-gold" />
        <span>Calculating statutory limitation timelines...</span>
      </div>
    );
  }

  if (!result) return null;

  const colorClasses = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    yellow: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
  };

  const Icon = {
    green: CircleCheck,
    yellow: CircleAlert,
    red: CircleX,
  }[result.color];

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 transition-all duration-300 ${colorClasses[result.color]}`}>
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div>
        <h4 className="font-serif text-sm font-bold capitalize">
          Timeline Status: {result.status.replaceAll("_", " ")}
        </h4>
        <p className="text-xs mt-1 leading-relaxed">{result.reason}</p>
        
        {/* Render timeline detail helper badge if present */}
        {result.days_remaining !== undefined && result.days_remaining >= 0 && (
          <span className="mt-2 inline-block rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold">
            {result.days_remaining} Days Remaining
          </span>
        )}
        {result.filing_deadline && (
          <span className="mt-2 inline-block rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold">
            Filing Deadline: {result.filing_deadline}
          </span>
        )}
      </div>
    </div>
  );
}
