"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Scale, X } from "lucide-react";
import {
  useStartIntake, useUpdateFacts, useRunAssessment, useCommitIntake,
} from "@/features/intake/hooks/useIntake";
import type { IntakeSession, Assessment, FactType } from "@/entities/types";

// ── Import Decomposed Step Components ─────────────────────────────
import { DomainStep } from "./steps/DomainStep";
import { SubtypeStep } from "./steps/SubtypeStep";
import { CoreFactsStep } from "./steps/CoreFactsStep";
import { CategoryFactsStep } from "./steps/CategoryFactsStep";
import { DescribeStep } from "./steps/DescribeStep";
import { AssessmentStep } from "./steps/AssessmentStep";
import { ConfirmationStep } from "./steps/ConfirmationStep";

// ── Step order ────────────────────────────────────────────────────
type Step = "domain" | "subtype" | "core_facts" | "category_facts" | "describe" | "facts" | "assessment" | "confirm" | "done";

import { DOMAINS, SUBTYPE_FIELDS } from "./intakeConstants";
import type { CategoryId, FieldDef } from "./intakeConstants";

// ── Core facts schema (always collected) ─────────────────────────
export const coreSchema = z.object({
  incident_date:      z.string().min(1, "Required"),
  incident_location:  z.string().min(2, "Required"),
  opponent_name:      z.string().min(2, "Required"),
  urgency_level:      z.enum(["exploring", "need_help_soon", "court_date_coming"]),
  preferred_language: z.enum(["Hindi", "English", "Telugu", "Tamil", "Kannada", "Marathi", "Bengali"]),
  prior_legal_action: z.enum(["yes", "no"]),
  prior_legal_detail: z.string().optional(),
  complainant_type:   z.enum(["Individual", "Proprietorship", "Partnership", "Company"]),
  has_documents:      z.enum(["Yes, I have key documents", "Some documents, not all", "No documents"]),
});
export type CoreForm = z.infer<typeof coreSchema>;

// ── Description schema ────────────────────────────────────────────
export const describeSchema = z.object({
  title: z.string().max(200).optional().or(z.literal("")).refine(
    (val) => !val || val.length >= 5,
    { message: "Min 5 characters" }
  ),
  description: z.string().optional().or(z.literal("")),
});
export type DescribeForm = z.infer<typeof describeSchema>;

// ── Helpers ───────────────────────────────────────────────────────
function toFact(key: string, value: any, label: string, type = "text") {
  const mappedType: FactType = (type === "string" ? "text" : type) as FactType;
  return { key, value, type: mappedType, label, confidence: 1.0, source: "user" };
}

export function urgencyLabel(v: string) {
  return { exploring: "Just exploring options", need_help_soon: "I need help soon", court_date_coming: "Court date coming up" }[v] ?? v;
}

export function getSubtypeLabel(id: string | null): string {
  if (!id) return "Case";
  for (const d of DOMAINS) {
    const found = d.subtypes.find(s => s.id === id);
    if (found) return found.label;
  }
  return id;
}

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
    complainant_type:   "Complainant type",
    has_documents:      "Are documents available?",
  };

  for (const [key, val] of Object.entries(core)) {
    if (!val) continue;
    const label = coreLabels[key as keyof CoreForm] ?? key;
    const displayVal = key === "urgency_level" ? urgencyLabel(val) : val;
    const vtype = key === "incident_date" ? "date" : "string";
    facts.push(toFact(key, displayVal, label, vtype));
  }

  // Category-specific fields
  const subFields = SUBTYPE_FIELDS[category] ?? [];
  for (const [key, val] of Object.entries(catFacts)) {
    if (!val) continue;
    const fieldDef = subFields.find(f => f.key === key);
    const label = fieldDef?.label ?? key;
    const vtype = fieldDef?.type === "number" ? "number" : fieldDef?.type === "date" ? "date" : "string";
    facts.push(toFact(key, val, label, vtype));
  }

  // Tag the category
  facts.push(toFact("category", category, "Case category", "string"));

  return facts;
}

// ═══════════════════════════════════════════════════════════════════
export function IntakeWizard({
  onClose,
  onOpenLegalNotice
}: {
  onClose: () => void;
  onOpenLegalNotice?: () => void;
}) {
  const router = useRouter();
  const [step, setStep]       = useState<Step>("domain");
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [category, setCat]    = useState<CategoryId | null>(null);
  const [coreFacts, setCore]  = useState<CoreForm | null>(null);
  const [catFacts, setCatFacts] = useState<Record<string, string>>({});
  const [session, setSess]    = useState<IntakeSession | null>(null);
  const [matterId, setMid]    = useState<string | null>(null);
  type PhaseError = { phase: "start" | "facts" | "assess"; message: string } | null;
  const [phaseError, setPhaseError] = useState<PhaseError>(null);
  const [pendingSession, setPending] = useState<IntakeSession | null>(null);

  const startIntake   = useStartIntake();
  const updateFacts   = useUpdateFacts();
  const runAssessment = useRunAssessment();
  const commitIntake  = useCommitIntake();

  const coreForm = useForm<CoreForm>({ resolver: zodResolver(coreSchema) });
  const descForm = useForm<DescribeForm>({ resolver: zodResolver(describeSchema) });

  // Load draft from sessionStorage on mount
  useEffect(() => {
    const draftJson = sessionStorage.getItem("lead_intake_wizard_draft");
    if (draftJson) {
      try {
        const draft = JSON.parse(draftJson);
        if (draft.step) setStep(draft.step);
        if (draft.selectedDomain) setSelectedDomain(draft.selectedDomain);
        if (draft.category) setCat(draft.category);
        if (draft.coreFacts) {
          setCore(draft.coreFacts);
          coreForm.reset(draft.coreFacts);
        }
        if (draft.catFacts) setCatFacts(draft.catFacts);
        if (draft.session) setSess(draft.session);
        if (draft.matterId) setMid(draft.matterId);
        if (draft.pendingSession) setPending(draft.pendingSession);
        if (draft.descFacts) {
          descForm.reset(draft.descFacts);
        }
      } catch (e) {
        console.error("Failed to restore intake wizard draft:", e);
      }
    }
  }, []);

  // Save draft to sessionStorage on changes
  useEffect(() => {
    if (step === "done") {
      sessionStorage.removeItem("lead_intake_wizard_draft");
      return;
    }

    const descValues = descForm.getValues();
    const draft = {
      step,
      selectedDomain,
      category,
      coreFacts,
      catFacts,
      session,
      matterId,
      pendingSession,
      descFacts: descValues,
    };
    sessionStorage.setItem("lead_intake_wizard_draft", JSON.stringify(draft));
  }, [step, selectedDomain, category, coreFacts, catFacts, session, matterId, pendingSession]);

  const isLoading = startIntake.isPending || updateFacts.isPending ||
                    runAssessment.isPending || commitIntake.isPending;

  const PROGRESS: Record<Step, number> = {
    domain: 5, subtype: 15, core_facts: 25, category_facts: 40,
    describe: 55, facts: 70, assessment: 82, confirm: 92, done: 100,
  };

  // ── Handlers ──────────────────────────────────────────────────
  function onDomainSelect(domainId: string) {
    if (domainId === "legal_notice") {
      if (onOpenLegalNotice) {
        onOpenLegalNotice();
      }
      onClose();
      return;
    }
    setSelectedDomain(domainId);
    setStep("subtype");
  }

  function onSubtypeSelect(subtypeId: CategoryId) {
    setCat(subtypeId);
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
    setPhaseError(null);

    const subtypeLabel = getSubtypeLabel(category);
    const title = data.title || `${subtypeLabel} — ${coreFacts.opponent_name}`;
    const description = data.description || "No additional description provided. Please refer to the structured facts.";

    // ── Phase 1: start (idempotent — creates session) ─────────────
    let s = pendingSession;
    if (!s || s.step === "facts_review") {
      try {
        s = await startIntake.mutateAsync({ title, description });
        setPending(s);
        setSess(s);
      } catch {
        setPhaseError({ phase: "start", message: "Could not start your session. Check your connection and try again." });
        return;
      }
    }

    // ── Phase 2: updateFacts (idempotent — overwrites facts) ──────
    if (s.step === "facts_review" || s.step === "assessment") {
      const structuredFacts = buildStructuredFacts(coreFacts, catFacts, category);
      const merged = [
        ...structuredFacts,
        ...(s.extracted_facts.facts ?? []).filter(f => !structuredFacts.some(sf => sf.key === f.key)),
      ];
      try {
        s = await updateFacts.mutateAsync({ sessionId: s.id, facts: merged });
        setPending(s);
        setSess(s);
      } catch {
        setPhaseError({ phase: "facts", message: "Facts were not saved. Please try again — your session is preserved." });
        return;
      }
    }

    // ── Phase 3: assess (idempotent — session already at 'assessment') ─
    if (s.step === "assessment" || s.step === "confirm") {
      try {
        const assessed = await runAssessment.mutateAsync(s.id);
        setSess(assessed);
        setPending(null); // clear pending once fully through
        setStep("assessment");
      } catch {
        setPhaseError({ phase: "assess", message: "The AI assessment failed. Your case details are saved — tap \"Retry assessment\" to try again." });
      }
    }
  }

  async function retryAssessment() {
    if (!pendingSession) return;
    setPhaseError(null);
    try {
      const assessed = await runAssessment.mutateAsync(pendingSession.id);
      setSess(assessed);
      setPending(null);
      setStep("assessment");
    } catch {
      setPhaseError({ phase: "assess", message: "Assessment failed again. Please wait a moment and retry." });
    }
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
    <div className="overflow-hidden rounded-2xl border border-brand-gold/15 bg-white shadow-2xl transition-all duration-300">
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
              {step === "domain"         && "Choose a legal domain"}
              {step === "subtype"        && "Select the type of dispute"}
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
        {step === "domain" && (
          <DomainStep onDomainSelect={onDomainSelect} />
        )}

        {step === "subtype" && selectedDomain && (
          <SubtypeStep
            selectedDomain={selectedDomain}
            onSubtypeSelect={onSubtypeSelect}
            onBack={() => setStep("domain")}
          />
        )}

        {step === "core_facts" && (
          <CoreFactsStep
            form={coreForm}
            onSubmit={onCoreFactsSubmit}
            onBack={() => setStep("subtype")}
          />
        )}

        {step === "category_facts" && category && (
          <CategoryFactsStep
            category={category}
            catFacts={catFacts}
            setCatFacts={setCatFacts}
            onNext={onCategoryFactsNext}
            onBack={() => setStep("core_facts")}
          />
        )}

        {step === "describe" && category && (
          <DescribeStep
            form={descForm}
            category={category}
            opponentName={coreFacts?.opponent_name}
            onSubmit={onDescribe}
            onBack={() => setStep("category_facts")}
            isLoading={isLoading}
            phaseError={phaseError}
            retryAssessment={retryAssessment}
            runAssessmentPending={runAssessment.isPending}
          />
        )}

        {step === "assessment" && a && (
          <AssessmentStep
            assessment={a}
            onNext={() => setStep("confirm")}
          />
        )}

        {(step === "confirm" || step === "done") && (
          <ConfirmationStep
            step={step}
            onCommit={onCommit}
            onBack={() => setStep("assessment")}
            onClose={onClose}
            isPending={commitIntake.isPending}
            error={commitIntake.error}
            matterId={matterId}
          />
        )}
      </div>
    </div>
  );
}
