"use client";

import { useState } from "react";
import { Calendar, CircleCheck, CircleAlert, CircleX, Landmark, Scale, IndianRupee } from "lucide-react";
import { Button, Card } from "@/shared/components/ui";
import { apiClient } from "@/shared/lib/api/client";

type Tab = "cheque" | "rera" | "cpc";

interface ChequeBounceResult {
  status: string;
  reason: string;
  color: string;
  presentation_days: number;
  presentation_valid: boolean;
  notice_days?: number;
  notice_valid?: boolean | null;
  wait_end_date?: string | null;
  filing_deadline?: string | null;
  filing_start_date?: string | null;
  filing_valid?: boolean | null;
}

interface ReraResult {
  status: string;
  reason: string;
  color: string;
  delay_days: number;
  interest_rate: number;
  interest_accrued: number;
  total_claim: number;
  // H5: staleness fields from backend
  mclr_rate_is_stale?: boolean;
  mclr_last_updated?: string;
}

interface CpcResult {
  status: string;
  reason: string;
  color: string;
  limitation_expiry: string;
  days_remaining: number;
  court_fee: number;
}

export function CalculatorsView() {
  const [activeTab, setActiveTab] = useState<Tab>("cheque");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Cheque Bounce States
  const [chequeDate, setChequeDate] = useState("");
  const [dishonourDate, setDishonourDate] = useState("");
  const [noticeDate, setNoticeDate] = useState("");
  const [noticeReceiptDate, setNoticeReceiptDate] = useState("");
  const [filedDate, setFiledDate] = useState("");
  const [chequeResult, setChequeResult] = useState<ChequeBounceResult | null>(null);

  // 2. RERA States
  const [paidAmount, setPaidAmount] = useState("");
  const [promisedDate, setPromisedDate] = useState("");
  const [actualDate, setActualDate] = useState("");
  const [customRate, setCustomRate] = useState("");
  const [reraResult, setReraResult] = useState<ReraResult | null>(null);

  // 3. CPC Summary Suit States
  const [claimAmount, setClaimAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [cpcState, setCpcState] = useState("default");
  const [cpcResult, setCpcResult] = useState<CpcResult | null>(null);

  async function handleChequeCalculate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setChequeResult(null);

    try {
      const res = await apiClient.post<ChequeBounceResult>("/legal-tools/calculators/cheque-bounce", {
        cheque_date: chequeDate,
        dishonour_date: dishonourDate,
        notice_date: noticeDate || null,
        notice_receipt_date: noticeReceiptDate || null,
        complaint_filed_date: filedDate || null,
      });
      setChequeResult(res);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to calculate timelines. Check date parameters.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  }

  async function handleReraCalculate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReraResult(null);

    try {
      const res = await apiClient.post<ReraResult>("/legal-tools/calculators/rera", {
        total_paid_amount: parseFloat(paidAmount),
        promised_possession_date: promisedDate,
        actual_possession_date: actualDate || null,
        custom_interest_rate: customRate ? parseFloat(customRate) : null,
      });
      setReraResult(res);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to calculate delay interest.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  }

  async function handleCpcCalculate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCpcResult(null);

    try {
      const res = await apiClient.post<CpcResult>("/legal-tools/calculators/summary-suit", {
        claim_amount: parseFloat(claimAmount),
        due_date: dueDate,
        state: cpcState,
      });
      setCpcResult(res);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to calculate limitation.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-brand-gold/15 bg-brand-blue-dark/5 p-1 rounded-xl gap-1 max-w-lg">
        <button
          onClick={() => { setActiveTab("cheque"); setError(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
            activeTab === "cheque"
              ? "bg-brand-blue-dark text-brand-gold shadow-md"
              : "text-brand-blue-dark/60 hover:bg-white/50"
          }`}
        >
          <Scale className="h-4 w-4" /> Cheque Bounce (138 NI)
        </button>
        <button
          onClick={() => { setActiveTab("rera"); setError(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
            activeTab === "rera"
              ? "bg-brand-blue-dark text-brand-gold shadow-md"
              : "text-brand-blue-dark/60 hover:bg-white/50"
          }`}
        >
          <Landmark className="h-4 w-4" /> RERA Possession
        </button>
        <button
          onClick={() => { setActiveTab("cpc"); setError(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
            activeTab === "cpc"
              ? "bg-brand-blue-dark text-brand-gold shadow-md"
              : "text-brand-blue-dark/60 hover:bg-white/50"
          }`}
        >
          <IndianRupee className="h-4 w-4" /> Court Fees (Order 37)
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2.5">
          <CircleX className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Cheque Bounce Checker Tab */}
      {activeTab === "cheque" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Form */}
          <Card className="p-6">
            <h3 className="font-serif text-lg font-bold mb-4">Section 138 Date Parameters</h3>
            <form onSubmit={handleChequeCalculate} className="space-y-4">
              <div className="block">
                <label htmlFor="chequeDate" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-blue-light/50">Cheque Date *</label>
                <input
                  id="chequeDate"
                  type="date"
                  required
                  value={chequeDate}
                  onChange={(e) => setChequeDate(e.target.value)}
                  className={INPUT_FIELD}
                />
              </div>
              <div className="block">
                <label htmlFor="dishonourDate" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-blue-light/50">Return Memo Date *</label>
                <input
                  id="dishonourDate"
                  type="date"
                  required
                  value={dishonourDate}
                  onChange={(e) => setDishonourDate(e.target.value)}
                  className={INPUT_FIELD}
                />
              </div>
              <div className="block">
                <label htmlFor="noticeDate" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-blue-light/50">Notice Sent Date (Optional)</label>
                <input
                  id="noticeDate"
                  type="date"
                  value={noticeDate}
                  onChange={(e) => setNoticeDate(e.target.value)}
                  className={INPUT_FIELD}
                />
              </div>
              <div className="block">
                <label htmlFor="noticeReceiptDate" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-blue-light/50">Notice Receipt Date (Optional)</label>
                <input
                  id="noticeReceiptDate"
                  type="date"
                  value={noticeReceiptDate}
                  onChange={(e) => setNoticeReceiptDate(e.target.value)}
                  className={INPUT_FIELD}
                />
              </div>
              <div className="block">
                <label htmlFor="filedDate" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-blue-light/50">Court Complaint Filing Date (Optional)</label>
                <input
                  id="filedDate"
                  type="date"
                  value={filedDate}
                  onChange={(e) => setFiledDate(e.target.value)}
                  className={INPUT_FIELD}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Calculating..." : "Calculate Timeline Limits"}
              </Button>
            </form>
          </Card>

          {/* Results Display */}
          <div className="space-y-6">
            {chequeResult ? (
              <Card className="p-6 space-y-5">
                {/* Result Alert Header */}
                <div className={`flex items-start gap-3 rounded-xl border p-4 ${
                  chequeResult.color === "green"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : chequeResult.color === "yellow"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}>
                  {chequeResult.color === "green" && <CircleCheck className="h-5 w-5 shrink-0 mt-0.5" />}
                  {chequeResult.color === "yellow" && <CircleAlert className="h-5 w-5 shrink-0 mt-0.5" />}
                  {chequeResult.color === "red" && <CircleX className="h-5 w-5 shrink-0 mt-0.5" />}
                  <div>
                    <h4 className="font-bold text-sm capitalize">{chequeResult.status.replaceAll("_", " ")}</h4>
                    <p className="text-xs mt-1 leading-relaxed">{chequeResult.reason}</p>
                  </div>
                </div>

                {/* Timeline Checklist */}
                <div className="space-y-4">
                  <h4 className="font-serif font-bold text-sm">Statutory Milestone Validation</h4>
                  <div className="space-y-3 pl-2 border-l border-brand-gold/12">
                    <MilestoneItem
                      label="Cheque Presentation"
                      desc={`Presented ${chequeResult.presentation_days} days from issuance`}
                      valid={chequeResult.presentation_valid}
                    />
                    <MilestoneItem
                      label="Demand Notice Sending"
                      desc={noticeDate ? `Sent ${chequeResult.notice_days} days after bounce` : "Required within 30 days of bounce memo"}
                      valid={chequeResult.notice_valid ?? null}
                    />
                    {chequeResult.wait_end_date && (
                      <MilestoneItem
                        label="Grace Wait Period (15 Days)"
                        desc={`Drawer grace wait ends: ${chequeResult.wait_end_date}`}
                        valid={true}
                      />
                    )}
                    {chequeResult.filing_deadline && (
                      <MilestoneItem
                        label="Court Complaint Window (30 Days)"
                        desc={`Filing window: ${chequeResult.filing_start_date} to ${chequeResult.filing_deadline}`}
                        valid={chequeResult.filing_valid ?? null}
                      />
                    )}
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-6 h-full flex flex-col justify-center items-center text-center py-12 text-brand-blue-light/45">
                <Calendar className="h-10 w-10 text-brand-gold/30 mb-3" />
                <p className="text-sm font-medium">Input cheque parameters to evaluate limitation timelines.</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* RERA Delay Interest Tab */}
      {activeTab === "rera" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Form */}
          <Card className="p-6">
            <h3 className="font-serif text-lg font-bold mb-4">RERA Delay Details</h3>
            <form onSubmit={handleReraCalculate} className="space-y-4">
              <div className="block">
                <label htmlFor="paidAmount" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-blue-light/50">Total Amount Paid (INR) *</label>
                <input
                  id="paidAmount"
                  type="number"
                  required
                  placeholder="e.g. 2500000"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className={INPUT_FIELD}
                />
              </div>
              <div className="block">
                <label htmlFor="promisedDate" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-blue-light/50">Promised Possession Date *</label>
                <input
                  id="promisedDate"
                  type="date"
                  required
                  value={promisedDate}
                  onChange={(e) => setPromisedDate(e.target.value)}
                  className={INPUT_FIELD}
                />
              </div>
              <div className="block">
                <label htmlFor="actualDate" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-blue-light/50">Actual Possession Offered Date (Optional)</label>
                <input
                  id="actualDate"
                  type="date"
                  value={actualDate}
                  onChange={(e) => setActualDate(e.target.value)}
                  className={INPUT_FIELD}
                />
              </div>
              <div className="block">
                <label htmlFor="customRate" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-blue-light/50">Custom Interest Rate % (Optional)</label>
                <input
                  id="customRate"
                  type="number"
                  step="0.05"
                  placeholder="e.g. 10.5 (defaults to SBI MCLR + 2%)"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  className={INPUT_FIELD}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Calculating..." : "Calculate Delay Interest"}
              </Button>
            </form>
          </Card>

          {/* Results Display */}
          <div className="space-y-6">
            {reraResult ? (
              <Card className="p-6 space-y-5">
                <div className={`flex items-start gap-3 rounded-xl border p-4 ${
                  reraResult.color === "green"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}>
                  {reraResult.color === "green" ? (
                    <CircleCheck className="h-5 w-5 shrink-0 mt-0.5" />
                  ) : (
                    <CircleAlert className="h-5 w-5 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="font-bold text-sm">Delay Interest Assessment</h4>
                    <p className="text-xs mt-1 leading-relaxed">{reraResult.reason}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-brand-gold/10 bg-brand-blue-dark/5 p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-blue-light/45">Delayed Days</p>
                    <p className="text-lg font-bold mt-1 text-brand-blue-dark">{reraResult.delay_days} days</p>
                  </div>
                  <div className="rounded-xl border border-brand-gold/10 bg-brand-blue-dark/5 p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-blue-light/45">RERA Interest Rate</p>
                    <p className="text-lg font-bold mt-1 text-brand-blue-dark">{reraResult.interest_rate}% p.a.</p>
                  </div>
                </div>

                <div className="h-px bg-brand-gold/12" />

                <div className="space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-blue-light/60">Principal Amount Paid:</span>
                    <span className="font-semibold text-brand-blue-dark">₹{parseFloat(paidAmount).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-blue-light/60">Accrued Delay Interest:</span>
                    <span className="font-bold text-brand-gold">₹{reraResult.interest_accrued.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between border-t border-brand-gold/12 pt-2.5 text-base">
                    <span className="font-serif font-bold text-brand-blue-dark">Total Compensation Claim:</span>
                    <span className="font-bold text-brand-blue-dark">₹{reraResult.total_claim.toLocaleString("en-IN")}</span>
                  </div>
                </div>
                {/* H5: MCLR staleness warning */}
                {reraResult.mclr_rate_is_stale && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-orange-300/40 bg-orange-50 p-3">
                    <svg className="h-4 w-4 shrink-0 text-orange-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                    <p className="text-xs text-orange-700 leading-relaxed">
                      <strong>Rate may be outdated.</strong> The SBI MCLR base rate used ({reraResult.mclr_last_updated}) may not reflect the current RBI-published rate. Verify the current 1-year MCLR at{" "}
                      <a href="https://homeloans.sbi/resources/pages/mclr" target="_blank" rel="noreferrer" className="underline">homeloans.sbi</a>{" "}
                      before using this figure in a legal filing.
                    </p>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="p-6 h-full flex flex-col justify-center items-center text-center py-12 text-brand-blue-light/45">
                <Landmark className="h-10 w-10 text-brand-gold/30 mb-3" />
                <p className="text-sm font-medium">Input project details to compute delay interest metrics.</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* CPC Summary Suit Tab */}
      {activeTab === "cpc" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Form */}
          <Card className="p-6">
            <h3 className="font-serif text-lg font-bold mb-4">Suit Recovery Parameters</h3>
            <form onSubmit={handleCpcCalculate} className="space-y-4">
              <div className="block">
                <label htmlFor="claimAmount" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-blue-light/50">Claim Amount (INR) *</label>
                <input
                  id="claimAmount"
                  type="number"
                  required
                  placeholder="e.g. 50000"
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(e.target.value)}
                  className={INPUT_FIELD}
                />
              </div>
              <div className="block">
                <label htmlFor="dueDate" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-blue-light/50">Debt Due Date *</label>
                <input
                  id="dueDate"
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={INPUT_FIELD}
                />
              </div>
              <div className="block">
                <label htmlFor="cpcState" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-blue-light/50">Indian Jurisdiction State *</label>
                <select
                  id="cpcState"
                  value={cpcState}
                  onChange={(e) => setCpcState(e.target.value)}
                  className={INPUT_FIELD}
                >
                  <option value="default">Default Scale (1.5%)</option>
                  <option value="delhi">Delhi</option>
                  <option value="maharashtra">Maharashtra</option>
                </select>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Calculating..." : "Estimate Court Fees & Timelines"}
              </Button>
            </form>
          </Card>

          {/* Results Display */}
          <div className="space-y-6">
            {cpcResult ? (
              <Card className="p-6 space-y-5">
                <div className={`flex items-start gap-3 rounded-xl border p-4 ${
                  cpcResult.color === "green"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : cpcResult.color === "yellow"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}>
                  {cpcResult.color === "green" && <CircleCheck className="h-5 w-5 shrink-0 mt-0.5" />}
                  {cpcResult.color === "yellow" && <CircleAlert className="h-5 w-5 shrink-0 mt-0.5" />}
                  {cpcResult.color === "red" && <CircleX className="h-5 w-5 shrink-0 mt-0.5" />}
                  <div>
                    <h4 className="font-bold text-sm">Recovery Suit Limitation</h4>
                    <p className="text-xs mt-1 leading-relaxed">{cpcResult.reason}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-brand-gold/10 bg-brand-blue-dark/5 p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-blue-light/45">Filing Expiry Deadline</p>
                    <p className="text-sm font-bold mt-1 text-brand-blue-dark">{cpcResult.limitation_expiry}</p>
                  </div>
                  <div className="rounded-xl border border-brand-gold/10 bg-brand-blue-dark/5 p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-blue-light/45">Days Remaining</p>
                    <p className="text-sm font-bold mt-1 text-brand-blue-dark">{cpcResult.days_remaining} days</p>
                  </div>
                </div>

                <div className="h-px bg-brand-gold/12" />

                <div className="space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-blue-light/60">Estimated Court Fees ({cpcState.toUpperCase()} scale):</span>
                    <span className="font-bold text-brand-blue-dark">₹{cpcResult.court_fee.toLocaleString("en-IN")}</span>
                  </div>
                  <p className="text-[10px] text-brand-blue-light/45 leading-relaxed bg-brand-blue-dark/5 p-2.5 rounded-lg">
                    ⚠️ Court fee estimations are approximate based on statutory schedules and exclude advocate retainer rates, stamp duties, and process server filing fees.
                  </p>
                </div>
              </Card>
            ) : (
              <Card className="p-6 h-full flex flex-col justify-center items-center text-center py-12 text-brand-blue-light/45">
                <IndianRupee className="h-10 w-10 text-brand-gold/30 mb-3" />
                <p className="text-sm font-medium">Input debt recovery parameters to calculate limitations.</p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const INPUT_FIELD = "min-h-10 w-full rounded-xl border border-brand-gold/15 bg-base-100 px-3.5 text-xs outline-none transition-all focus:border-brand-gold focus:bg-white focus:shadow-sm";

function MilestoneItem({ label, desc, valid }: { label: string; desc: string; valid: boolean | null }) {
  return (
    <div className="flex items-start gap-2.5 py-1">
      {valid === null ? (
        <div className="h-4 w-4 rounded-full border-2 border-brand-gold/30 shrink-0 mt-0.5" />
      ) : valid ? (
        <CircleCheck className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
      ) : (
        <CircleX className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-brand-blue-dark leading-tight">{label}</p>
        <p className="text-[10px] text-brand-blue-light/55 mt-0.5 leading-snug">{desc}</p>
      </div>
    </div>
  );
}
