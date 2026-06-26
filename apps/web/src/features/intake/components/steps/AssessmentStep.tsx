"use client";

import { Clock, DollarSign, BookOpen, Gavel, Zap, FileText, AlertTriangle, CheckCircle } from "lucide-react";
import { Assessment } from "@/entities/types";

interface AssessmentStepProps {
  assessment: Assessment;
  onNext: () => void;
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

export function AssessmentStep({ assessment: a, onNext }: AssessmentStepProps) {
  // H1: Convert precise integer probability into a qualitative range to avoid
  // implying false statistical precision in an AI-generated assessment.
  const prob = a.success_probability ?? 50;
  const probabilityLabel =
    prob >= 75 ? "Strong" : prob >= 60 ? "Moderate" : prob >= 40 ? "Fair" : "Uncertain";
  const probabilityRange =
    prob >= 75 ? "70–85%" : prob >= 60 ? "55–70%" : prob >= 40 ? "35–55%" : "Below 40%";
  const probabilityColor =
    prob >= 75 ? "text-brand-teal" : prob >= 60 ? "text-brand-gold" : "text-red-500";

  return (
    <div className="space-y-4 p-6">
      {/* H1: Prominent AI disclaimer — must appear before any metrics */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/8 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">AI-Generated Preliminary Assessment</p>
          <p className="text-xs leading-5 text-amber-700/80">
            This analysis is produced by an AI model and is <strong>not legal advice</strong>. All estimates — including success likelihood, timeline, and cost — are indicative only and carry inherent uncertainty. <strong>Consult a qualified lawyer before taking any legal action or relying on these figures.</strong>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          label="Risk"
          value={(a.risk_level ?? "—").toUpperCase()}
          color={
            a.risk_level === "urgent"
              ? "text-red-500"
              : a.risk_level === "high"
              ? "text-brand-gold"
              : a.risk_level === "low"
              ? "text-brand-teal"
              : "text-brand-accent"
          }
        />
        {/* H1: Show qualitative label + range instead of precise integer */}
        <MetricCard
          label="Chance of success"
          value={`${probabilityLabel} (${probabilityRange})`}
          color={probabilityColor}
        />
        <MetricCard label="Complexity" value={a.complexity ?? "—"} color="text-brand-blue-dark" />
      </div>

      <p className="rounded-xl border border-brand-teal/15 bg-brand-teal/5 px-4 py-3 text-sm leading-7 text-brand-blue-dark/80">
        {a.success_rationale}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <InfoBox icon={Clock} label="Estimated timeline">
          <p className="font-serif text-xl font-bold">{a.timeline_min_months}–{a.timeline_max_months} months</p>
        </InfoBox>
        <InfoBox icon={DollarSign} label="Estimated cost (₹)">
          <p className="font-serif text-xl font-bold">₹{(a.budget_min_inr ?? 0).toLocaleString("en-IN")}+</p>
          <p className="text-xs text-brand-blue-light/50">
            up to ₹{(a.budget_max_inr ?? 0).toLocaleString("en-IN")}
          </p>
        </InfoBox>
      </div>

      <InfoBox icon={BookOpen} label="Key laws involved">
        <div className="flex flex-wrap gap-1.5">
          {(a.key_statutes ?? []).map((s) => (
            <StatuteBadge key={s} text={s} />
          ))}
        </div>
      </InfoBox>
      <InfoBox icon={Gavel} label="Where to file">
        <p className="text-sm font-semibold">{a.recommended_forum}</p>
      </InfoBox>
      <InfoBox icon={Zap} label="What to do next">
        <ol className="space-y-2">
          {(a.immediate_actions ?? []).map((action, i) => (
            <li key={action} className="flex gap-3 text-sm leading-6">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-gold text-[10px] font-bold text-brand-blue-dark mt-0.5">
                {i + 1}
              </span>
              {action}
            </li>
          ))}
        </ol>
      </InfoBox>
      <InfoBox icon={FileText} label="Documents to gather">
        <ul className="space-y-1.5">
          {(a.evidence_needed ?? []).map((e) => (
            <li key={e} className="flex items-start gap-2.5 text-sm leading-5">
              <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-teal" />
              {e}
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

      {/* Provider attribution — brief and non-legal */}
      <p className="text-[10px] text-brand-blue-light/35">
        via {a.provider} · for informational purposes only
      </p>

      <button
        type="button"
        onClick={onNext}
        className="shimmer-btn w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-5 py-3 text-sm font-semibold text-brand-blue-dark transition-all hover:bg-brand-gold-light"
      >
        <CheckCircle className="h-4 w-4" /> Create my case file
      </button>
    </div>
  );
}
