"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle, ArrowLeft, ArrowRight, BookOpen,
  CheckCircle, Clock, DollarSign, FileText, Gavel,
  Scale, Sparkles, X, Zap,
} from "lucide-react";
import {
  useStartIntake, useUpdateFacts, useRunAssessment, useCommitIntake,
} from "@/features/intake/hooks/useIntake";
import type { IntakeSession, Assessment } from "@/entities/types";

// ── Step order ────────────────────────────────────────────────────
type Step = "category" | "core_facts" | "category_facts" | "describe" | "facts" | "assessment" | "confirm" | "done";

// ── Category definitions ──────────────────────────────────────────
const CATEGORIES = [
  { id: "cheque_bounce", label: "Cheque Bounce",   icon: "💳", desc: "Bounced cheque, dishonour, NI Act" },
  { id: "consumer",     label: "Consumer",          icon: "🛒", desc: "Defective product, bad service, refund" },
  { id: "rera",         label: "Builder / RERA",    icon: "🏗️", desc: "Flat possession, builder delay, RERA" },
  { id: "property",     label: "Property",          icon: "🏠", desc: "Ownership, encroachment, land dispute" },
  { id: "family",       label: "Family",            icon: "👪", desc: "Divorce, custody, maintenance, matrimonial" },
  { id: "labour",       label: "Labour / Employment", icon: "💼", desc: "Termination, salary dues, PF, gratuity" },
  { id: "criminal",     label: "Criminal",          icon: "⚖️", desc: "FIR, assault, theft, defence" },
  { id: "cyber",        label: "Cyber / Online",    icon: "💻", desc: "Fraud, hacking, phishing, online scam" },
  { id: "other",        label: "Something else",    icon: "📋", desc: "Other legal matter" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

// ── Core facts schema (always collected) ─────────────────────────
const coreSchema = z.object({
  incident_date:      z.string().min(1, "Required"),
  incident_location:  z.string().min(2, "Required"),
  opponent_name:      z.string().min(2, "Required"),
  urgency_level:      z.enum(["exploring", "need_help_soon", "court_date_coming"]),
  preferred_language: z.enum(["Hindi", "English", "Telugu", "Tamil", "Kannada", "Marathi", "Bengali"]),
  prior_legal_action: z.enum(["yes", "no"]),
  prior_legal_detail: z.string().optional(),
});
type CoreForm = z.infer<typeof coreSchema>;

// ── Category-specific fields ──────────────────────────────────────
// Each entry: { key, label, type, options?, placeholder?, conditionalOn? }
type FieldDef = {
  key: string; label: string;
  type: "text" | "number" | "date" | "yesno" | "select";
  placeholder?: string; options?: string[];
};

const CATEGORY_FIELDS: Record<CategoryId, FieldDef[]> = {
  cheque_bounce: [
    { key: "cheque_amount",       label: "Amount on the cheque (₹)",            type: "number", placeholder: "e.g. 75000" },
    { key: "cheque_date",         label: "Date written on the cheque",            type: "date" },
    { key: "dishonour_date",      label: "Date it was returned / bounced",        type: "date" },
    { key: "dishonour_reason",    label: "Reason for dishonour",                  type: "select",
      options: ["Insufficient funds", "Payment stopped", "Account closed", "Signature mismatch", "Other"] },
    { key: "legal_notice_sent",   label: "Has a legal notice been sent?",         type: "yesno" },
    { key: "underlying_debt_type",label: "What was the cheque for?",              type: "select",
      options: ["Loan repayment", "Service payment", "Goods payment", "Security deposit", "Other"] },
  ],
  consumer: [
    { key: "product_service",  label: "What product or service was involved?",  type: "text",   placeholder: "e.g. Refrigerator, AC repair" },
    { key: "purchase_amount",  label: "Amount paid (₹)",                         type: "number", placeholder: "e.g. 25000" },
    { key: "purchase_date",    label: "Date of purchase",                         type: "date" },
    { key: "company_name",     label: "Company or seller name",                   type: "text",   placeholder: "e.g. Amazon, LG Electronics" },
    { key: "defect_type",      label: "What went wrong?",                         type: "text",   placeholder: "e.g. Product stopped working after 2 days" },
    { key: "complaint_sent",   label: "Have you complained to the company?",      type: "yesno" },
  ],
  rera: [
    { key: "project_name",            label: "Name of the housing project",         type: "text",   placeholder: "e.g. DLF The Crest" },
    { key: "builder_name",            label: "Builder / developer name",             type: "text",   placeholder: "e.g. DLF Ltd" },
    { key: "flat_number",             label: "Flat or unit number",                  type: "text",   placeholder: "e.g. C-1204" },
    { key: "total_paid_amount",       label: "Total amount paid so far (₹)",         type: "number", placeholder: "e.g. 4500000" },
    { key: "promised_possession_date",label: "Possession date promised",             type: "date" },
    { key: "rera_registered",         label: "Is the project RERA registered?",      type: "yesno" },
  ],
  property: [
    { key: "property_type",     label: "Type of property",          type: "select",
      options: ["Agricultural land", "Residential plot", "Flat / apartment", "Commercial property", "Other"] },
    { key: "dispute_type",      label: "Nature of the dispute",     type: "select",
      options: ["Ownership dispute", "Encroachment", "Title / documentation", "Boundary dispute", "Illegal construction", "Other"] },
    { key: "property_location", label: "Where is the property?",   type: "text",   placeholder: "e.g. Sector 12, Dwarka, Delhi" },
    { key: "documents_available",label: "Documents you have",       type: "text",   placeholder: "e.g. Sale deed, Aadhaar, Tax receipts" },
  ],
  family: [
    { key: "marriage_date",     label: "Date of marriage",                                 type: "date" },
    { key: "children_involved", label: "Are children involved?",                           type: "yesno" },
    { key: "relief_sought",     label: "What are you looking for?",  type: "select",
      options: ["Divorce", "Child custody", "Maintenance / alimony", "Domestic violence protection", "Property division", "Other"] },
  ],
  labour: [
    { key: "issue_type",          label: "Type of issue",                type: "select",
      options: ["Wrongful termination", "Unpaid salary", "PF / gratuity dispute", "Workplace harassment", "Contract dispute", "Other"] },
    { key: "employer_name",       label: "Employer / company name",      type: "text",   placeholder: "e.g. Infosys Ltd" },
    { key: "employment_duration", label: "How long were you employed?",   type: "text",   placeholder: "e.g. 3 years 4 months" },
    { key: "amount_in_dispute",   label: "Amount in dispute (₹), if any",type: "number", placeholder: "e.g. 180000" },
    { key: "termination_date",    label: "Date of termination (if terminated)", type: "date" },
  ],
  criminal: [
    { key: "offence_type",  label: "Nature of the offence",      type: "text",   placeholder: "e.g. Assault, cheating, theft" },
    { key: "fir_filed",     label: "Has an FIR been filed?",     type: "yesno" },
    { key: "police_station",label: "Police station (if FIR filed)", type: "text", placeholder: "e.g. Bandra Police Station, Mumbai" },
  ],
  cyber: [
    { key: "cyber_incident_type", label: "Type of cyber incident",     type: "select",
      options: ["Online fraud / scam", "Hacking / account breach", "Phishing", "Cyberstalking", "Identity theft", "Other"] },
    { key: "amount_lost",         label: "Amount lost (₹), if any",    type: "number", placeholder: "e.g. 50000" },
    { key: "platform_name",       label: "Platform or website involved",type: "text",   placeholder: "e.g. WhatsApp, OLX, bank website" },
  ],
  other: [
    { key: "dispute_type",   label: "Describe the nature of the dispute", type: "text", placeholder: "e.g. Contract dispute with a contractor" },
    { key: "amount_involved",label: "Amount involved (₹), if any",         type: "number", placeholder: "e.g. 100000" },
  ],
};

// ── Description schema ────────────────────────────────────────────
const describeSchema = z.object({
  title:       z.string().min(5, "Min 5 characters").max(200),
  description: z.string().min(10, "Add any extra details that weren't covered above"),
});
type DescribeForm = z.infer<typeof describeSchema>;

// ── Helpers ───────────────────────────────────────────────────────
function toFact(key: string, value: string, label: string, type = "string") {
  return { key, value, value_type: type, label, confidence: 1.0, source: "user" };
}

function urgencyLabel(v: string) {
  return { exploring: "Just exploring options", need_help_soon: "I need help soon", court_date_coming: "Court date coming up" }[v] ?? v;
}

// ═══════════════════════════════════════════════════════════════════
export function IntakeWizard({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep]       = useState<Step>("category");
  const [category, setCat]    = useState<CategoryId | null>(null);
  const [coreFacts, setCore]  = useState<CoreForm | null>(null);
  const [catFacts, setCatFacts] = useState<Record<string, string>>({});
  const [session, setSess]    = useState<IntakeSession | null>(null);
  const [matterId, setMid]    = useState<string | null>(null);

  const startIntake   = useStartIntake();
  const updateFacts   = useUpdateFacts();
  const runAssessment = useRunAssessment();
  const commitIntake  = useCommitIntake();

  const coreForm = useForm<CoreForm>({ resolver: zodResolver(coreSchema) });
  const descForm = useForm<DescribeForm>({ resolver: zodResolver(describeSchema) });

  const isLoading = startIntake.isPending || updateFacts.isPending ||
                    runAssessment.isPending || commitIntake.isPending;

  const PROGRESS: Record<Step, number> = {
    category: 10, core_facts: 25, category_facts: 40,
    describe: 55, facts: 70, assessment: 82, confirm: 92, done: 100,
  };

  // ── Handlers ──────────────────────────────────────────────────
  function onCategorySelect(id: CategoryId) {
    setCat(id);
    setStep("core_facts");
  }

  function onCoreFactsSubmit(data: CoreForm) {
    setCore(data);
    setStep("category_facts");
  }

  function onCategoryFactsNext() {
    setStep("describe");
  }

  async function onDescribe(data: DescribeForm) {
    if (!category || !coreFacts) return;

    // Build a title if user didn't provide enough
    const title = data.title || `${CATEGORIES.find(c => c.id === category)?.label} — ${coreFacts.opponent_name}`;

    // Start intake with the description
    const s = await startIntake.mutateAsync({ title, description: data.description || "See structured facts." });
    setSess(s);

    // Merge structured facts on top of AI-extracted facts
    // Structured facts (source: "user", confidence: 1.0) take precedence
    const structuredFacts = buildStructuredFacts(coreFacts, catFacts, category);
    const aiFactKeys = new Set((s.extracted_facts.facts ?? []).map(f => f.key));
    const merged = [
      ...structuredFacts,
      // Keep AI facts that don't overlap with structured ones
      ...(s.extracted_facts.facts ?? []).filter(f => !structuredFacts.some(sf => sf.key === f.key)),
    ];

    const updated = await updateFacts.mutateAsync({ sessionId: s.id, facts: merged });
    setSess(updated);
    const assessed = await runAssessment.mutateAsync(s.id);
    setSess(assessed);
    setStep("assessment");
  }

  async function onCommit() {
    if (!session) return;
    const result = await commitIntake.mutateAsync({
      sessionId: session.id,
      confirmed_facts: session.extracted_facts.facts ?? [],
    });
    setMid(result.matter_id);
    setStep("done");
  }

  const a = session?.assessment_result as Assessment | undefined;

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-gold/15 bg-white shadow-2xl">
      {/* Progress bar */}
      <div className="h-1 bg-base-300">
        <div className="h-full bg-brand-gold transition-all duration-500" style={{ width: `${PROGRESS[step]}%` }} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-brand-gold/12 bg-gradient-to-r from-base-200/60 to-base-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-blue-dark">
            <Scale className="h-4 w-4 text-brand-gold animate-scale-tilt" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-bold">
              {step === "category"       && "What's your case about?"}
              {step === "core_facts"     && "A few quick details"}
              {step === "category_facts" && "Tell us more about your case"}
              {step === "describe"       && "Anything else to add?"}
              {step === "facts"          && "Review your case details"}
              {step === "assessment"     && "Your legal assessment"}
              {step === "confirm"        && "Confirm and create your case"}
              {step === "done"           && "Your case has been created"}
            </h2>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-blue-light/40">
              LeAd · Free assessment
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose}
          className="rounded-xl p-2 text-brand-blue-light/40 hover:bg-base-200 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="custom-scrollbar max-h-[75vh] overflow-y-auto">

        {/* ── Step 1: Category ──────────────────────────────── */}
        {step === "category" && (
          <div className="p-6 space-y-4">
            <p className="text-sm text-brand-blue-light/60">
              Choose the category that best matches your situation. This helps us ask the right questions.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {CATEGORIES.map((c) => (
                <button key={c.id} type="button" onClick={() => onCategorySelect(c.id)}
                  className="flex flex-col gap-2 rounded-xl border border-brand-gold/12 bg-base-100 p-4 text-left transition-all hover:border-brand-gold/35 hover:bg-brand-gold/5 hover:-translate-y-0.5 hover:shadow-sm">
                  <span className="text-2xl">{c.icon}</span>
                  <p className="font-semibold text-[13px] text-brand-blue-dark">{c.label}</p>
                  <p className="text-[11px] text-brand-blue-light/50 leading-4">{c.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Core Facts ────────────────────────────── */}
        {step === "core_facts" && (
          <form onSubmit={coreForm.handleSubmit(onCoreFactsSubmit)} className="space-y-5 p-6">
            <p className="text-xs text-brand-blue-light/50">
              These few questions apply to every case. No legal jargon — just tell us what happened.
            </p>

            <Field label="When did this happen?">
              <input type="date" {...coreForm.register("incident_date")}
                className="form-input" />
              <Err msg={coreForm.formState.errors.incident_date?.message} />
            </Field>

            <Field label="Where did this happen? (city and state)">
              <input type="text" placeholder="e.g. Bangalore, Karnataka"
                {...coreForm.register("incident_location")}
                className="form-input" />
              <Err msg={coreForm.formState.errors.incident_location?.message} />
            </Field>

            <Field label="Who is on the other side? (person or company name)">
              <input type="text" placeholder="e.g. Rakesh Sharma or HDFC Bank"
                {...coreForm.register("opponent_name")}
                className="form-input" />
              <Err msg={coreForm.formState.errors.opponent_name?.message} />
            </Field>

            <Field label="How urgent is this?">
              <div className="grid grid-cols-3 gap-2">
                {(["exploring", "need_help_soon", "court_date_coming"] as const).map(v => (
                  <label key={v}
                    className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-all ${
                      coreForm.watch("urgency_level") === v
                        ? "border-brand-gold bg-brand-gold/8 text-brand-blue-dark"
                        : "border-brand-gold/15 text-brand-blue-light/60 hover:border-brand-gold/30"
                    }`}>
                    <input type="radio" value={v} {...coreForm.register("urgency_level")} className="sr-only" />
                    <span className="text-[11px] font-semibold leading-4">{urgencyLabel(v)}</span>
                  </label>
                ))}
              </div>
              <Err msg={coreForm.formState.errors.urgency_level?.message} />
            </Field>

            <Field label="Preferred language for communication">
              <select {...coreForm.register("preferred_language")} className="form-input">
                {["English", "Hindi", "Telugu", "Tamil", "Kannada", "Marathi", "Bengali"].map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </Field>

            <Field label="Has any FIR or court case been filed about this?">
              <div className="flex gap-3">
                {(["no", "yes"] as const).map(v => (
                  <label key={v}
                    className={`flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-xl border py-2.5 transition-all ${
                      coreForm.watch("prior_legal_action") === v
                        ? "border-brand-gold bg-brand-gold/8 font-semibold text-brand-blue-dark"
                        : "border-brand-gold/15 text-brand-blue-light/60 hover:border-brand-gold/30"
                    }`}>
                    <input type="radio" value={v} {...coreForm.register("prior_legal_action")} className="sr-only" />
                    {v === "yes" ? "Yes" : "No"}
                  </label>
                ))}
              </div>
              {coreForm.watch("prior_legal_action") === "yes" && (
                <input type="text" placeholder="Brief details (e.g. FIR at Bandra PS, Case No. 123/2025)"
                  {...coreForm.register("prior_legal_detail")}
                  className="form-input mt-2" />
              )}
            </Field>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setStep("category")}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-gold/15 px-4 py-2 text-sm font-medium text-brand-blue-light/60 hover:bg-base-200 transition-colors">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button type="submit"
                className="shimmer-btn flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-semibold text-brand-blue-dark transition-all hover:bg-brand-gold-light">
                <ArrowRight className="h-4 w-4" /> Continue
              </button>
            </div>
          </form>
        )}

        {/* ── Step 3: Category-specific Facts ──────────────── */}
        {step === "category_facts" && category && (
          <div className="space-y-5 p-6">
            <p className="text-xs text-brand-blue-light/50">
              These details are specific to your type of case. Fill in what you know — skip anything that doesn't apply.
            </p>

            {CATEGORY_FIELDS[category].map((field) => (
              <Field key={field.key} label={field.label}>
                {field.type === "yesno" ? (
                  <div className="flex gap-3">
                    {["yes", "no"].map(v => (
                      <label key={v}
                        className={`flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-xl border py-2.5 transition-all ${
                          catFacts[field.key] === v
                            ? "border-brand-gold bg-brand-gold/8 font-semibold text-brand-blue-dark"
                            : "border-brand-gold/15 text-brand-blue-light/60 hover:border-brand-gold/30"
                        }`}>
                        <input type="radio" name={field.key} value={v}
                          checked={catFacts[field.key] === v}
                          onChange={() => setCatFacts(p => ({ ...p, [field.key]: v }))}
                          className="sr-only" />
                        {v === "yes" ? "Yes" : "No"}
                      </label>
                    ))}
                  </div>
                ) : field.type === "select" ? (
                  <select value={catFacts[field.key] ?? ""}
                    onChange={e => setCatFacts(p => ({ ...p, [field.key]: e.target.value }))}
                    className="form-input">
                    <option value="">— Select —</option>
                    {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                    placeholder={field.placeholder}
                    value={catFacts[field.key] ?? ""}
                    onChange={e => setCatFacts(p => ({ ...p, [field.key]: e.target.value }))}
                    className="form-input" />
                )}
              </Field>
            ))}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setStep("core_facts")}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-gold/15 px-4 py-2 text-sm font-medium text-brand-blue-light/60 hover:bg-base-200 transition-colors">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button type="button" onClick={onCategoryFactsNext}
                className="shimmer-btn flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-semibold text-brand-blue-dark transition-all hover:bg-brand-gold-light">
                <ArrowRight className="h-4 w-4" /> Continue
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Description (supplementary) ──────────── */}
        {step === "describe" && (
          <form onSubmit={descForm.handleSubmit(onDescribe)} className="space-y-5 p-6">
            <Field label="Give your case a short title">
              <input {...descForm.register("title")}
                placeholder={`e.g. ${CATEGORIES.find(c => c.id === category)?.label} — ${coreFacts?.opponent_name ?? "party name"}`}
                className="form-input" />
              <Err msg={descForm.formState.errors.title?.message} />
            </Field>

            <Field label="Anything else you'd like us to know? (optional)">
              <textarea {...descForm.register("description")} rows={5}
                placeholder="Add any extra context, timeline, or details that weren't covered in the form above..."
                className="form-input resize-none" />
              <p className="mt-1 text-[10px] text-brand-blue-light/40">
                This is optional — the structured details you've already entered are enough for a good assessment.
              </p>
            </Field>

            <div className="rounded-xl border border-brand-gold/12 bg-brand-gold/5 p-4 text-xs leading-6 text-brand-blue-light/60">
              <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-brand-gold" />
              AI will now review everything you've entered and generate your legal assessment.
            </div>

            {startIntake.error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                Something went wrong. Please try again.
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setStep("category_facts")}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-gold/15 px-4 py-2 text-sm font-medium text-brand-blue-light/60 hover:bg-base-200 transition-colors">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button type="submit" disabled={isLoading}
                className="shimmer-btn flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-blue-dark px-5 py-2.5 text-sm font-semibold text-brand-gold transition-all hover:bg-brand-blue-light disabled:opacity-50">
                {isLoading ? <><Loader /> Reviewing your case…</> : <><Sparkles className="h-4 w-4" /> Get my assessment</>}
              </button>
            </div>
          </form>
        )}

        {/* ── Step 5: Assessment results ────────────────────── */}
        {step === "assessment" && a && (
          <div className="space-y-4 p-6">
            <div className="grid grid-cols-3 gap-3">
              <MetricCard label="Risk" value={(a.risk_level ?? "—").toUpperCase()}
                color={a.risk_level === "urgent" ? "text-red-500" : a.risk_level === "high" ? "text-brand-gold" : a.risk_level === "low" ? "text-brand-teal" : "text-brand-accent"} />
              <MetricCard label="Chance of success" value={`${a.success_probability}%`}
                color={a.success_probability >= 70 ? "text-brand-teal" : a.success_probability >= 50 ? "text-brand-gold" : "text-red-500"} />
              <MetricCard label="Complexity" value={a.complexity ?? "—"} color="text-brand-blue-dark" />
            </div>

            <p className="rounded-xl border border-brand-teal/15 bg-brand-teal/5 px-4 py-3 text-sm leading-7 text-brand-blue-dark/80">{a.success_rationale}</p>

            <div className="grid grid-cols-2 gap-3">
              <InfoBox icon={Clock} label="Estimated timeline">
                <p className="font-serif text-xl font-bold">{a.timeline_min_months}–{a.timeline_max_months} months</p>
              </InfoBox>
              <InfoBox icon={DollarSign} label="Estimated cost (₹)">
                <p className="font-serif text-xl font-bold">₹{(a.budget_min_inr ?? 0).toLocaleString("en-IN")}+</p>
                <p className="text-xs text-brand-blue-light/50">up to ₹{(a.budget_max_inr ?? 0).toLocaleString("en-IN")}</p>
              </InfoBox>
            </div>

            <InfoBox icon={BookOpen} label="Key laws involved">
              <div className="flex flex-wrap gap-1.5">{(a.key_statutes ?? []).map(s => <StatuteBadge key={s} text={s} />)}</div>
            </InfoBox>
            <InfoBox icon={Gavel} label="Where to file">
              <p className="text-sm font-semibold">{a.recommended_forum}</p>
            </InfoBox>
            <InfoBox icon={Zap} label="What to do next">
              <ol className="space-y-2">
                {(a.immediate_actions ?? []).map((action, i) => (
                  <li key={action} className="flex gap-3 text-sm leading-6">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-gold text-[10px] font-bold text-brand-blue-dark mt-0.5">{i + 1}</span>
                    {action}
                  </li>
                ))}
              </ol>
            </InfoBox>
            <InfoBox icon={FileText} label="Documents to gather">
              <ul className="space-y-1.5">
                {(a.evidence_needed ?? []).map(e => (
                  <li key={e} className="flex items-start gap-2.5 text-sm leading-5">
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-teal" />{e}
                  </li>
                ))}
              </ul>
            </InfoBox>

            {a.limitation_risk && (
              <div className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-50 p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1">Time limit warning</p>
                  <p className="text-sm leading-6 text-red-700">{a.limitation_risk}</p>
                </div>
              </div>
            )}

            <p className="text-[11px] text-brand-blue-light/40 italic">via {a.provider} · review by a qualified lawyer required before filing</p>

            <button type="button" onClick={() => setStep("confirm")}
              className="shimmer-btn w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-5 py-3 text-sm font-semibold text-brand-blue-dark transition-all hover:bg-brand-gold-light">
              <CheckCircle className="h-4 w-4" /> Create my case file
            </button>
          </div>
        )}

        {/* ── Step 6: Confirm ───────────────────────────────── */}
        {step === "confirm" && (
          <div className="space-y-5 p-6">
            <p className="text-sm text-brand-blue-light/65">
              Your case file will be created with all the details you've entered and the AI assessment.
              A lawyer will be matched to your case shortly.
            </p>
            {commitIntake.error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">Something went wrong — please try again.</p>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep("assessment")}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-gold/15 px-4 py-2.5 text-sm font-medium text-brand-blue-light/60 hover:bg-base-200 transition-colors">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button type="button" onClick={onCommit} disabled={commitIntake.isPending}
                className="shimmer-btn flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-blue-dark px-5 py-2.5 text-sm font-semibold text-brand-gold transition-all hover:bg-brand-blue-light disabled:opacity-50">
                {commitIntake.isPending ? <><Loader /> Creating…</> : <><CheckCircle className="h-4 w-4" /> Confirm and create case</>}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 7: Done ──────────────────────────────────── */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-5 py-16 text-center px-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-teal/10 border border-brand-teal/25">
              <CheckCircle className="h-8 w-8 text-brand-teal" />
            </div>
            <div>
              <h3 className="font-serif text-2xl font-bold">Your case is created</h3>
              <p className="mt-2 text-sm text-brand-blue-light/55">
                Your details and assessment are saved. We'll find the right lawyer for you shortly.
              </p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="rounded-xl border border-brand-gold/20 px-4 py-2 text-sm font-medium text-brand-blue-light/60 hover:bg-base-200 transition-colors">
                Close
              </button>
              {matterId && (
                <button type="button" onClick={() => { onClose(); router.push(`/user/matters/${matterId}`); }}
                  className="shimmer-btn rounded-xl bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-blue-dark hover:bg-brand-gold-light transition-all">
                  View my case
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────
function buildStructuredFacts(
  core: CoreForm,
  catFacts: Record<string, string>,
  category: CategoryId
): ReturnType<typeof toFact>[] {
  const facts: ReturnType<typeof toFact>[] = [];

  const coreLabels: Record<keyof CoreForm, string> = {
    incident_date:      "When did this happen?",
    incident_location:  "Where did this happen?",
    opponent_name:      "Other party",
    urgency_level:      "How urgent is this?",
    preferred_language: "Preferred language",
    prior_legal_action: "Has any FIR or case been filed?",
    prior_legal_detail: "Prior legal action details",
  };

  for (const [key, val] of Object.entries(core)) {
    if (!val) continue;
    const label = coreLabels[key as keyof CoreForm] ?? key;
    const displayVal = key === "urgency_level" ? urgencyLabel(val) : val;
    const vtype = key === "incident_date" ? "date" : "string";
    facts.push(toFact(key, displayVal, label, vtype));
  }

  // Category-specific fields
  const catFields = CATEGORY_FIELDS[category] ?? [];
  for (const [key, val] of Object.entries(catFacts)) {
    if (!val) continue;
    const fieldDef = catFields.find(f => f.key === key);
    const label = fieldDef?.label ?? key;
    const vtype = fieldDef?.type === "number" ? "number" : fieldDef?.type === "date" ? "date" : "string";
    facts.push(toFact(key, val, label, vtype));
  }

  // Tag the category
  facts.push(toFact("category", category, "Case category", "string"));

  return facts;
}

// ── Sub-components ────────────────────────────────────────────────
function Loader() {
  return <span className="h-4 w-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue-light/50">
        {label}
      </label>
      {children}
    </div>
  );
}

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs text-red-500">{msg}</p> : null;
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-brand-gold/12 bg-base-100 p-4 text-center">
      <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-brand-blue-light/40">{label}</p>
      <p className={`mt-2 font-serif text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function InfoBox({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-brand-gold/12 bg-base-100 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand-gold" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue-light/45">{label}</p>
      </div>
      {children}
    </div>
  );
}

function StatuteBadge({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-brand-accent/25 bg-brand-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-accent">
      {text}
    </span>
  );
}
