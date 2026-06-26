"use client";

import { UseFormReturn } from "react-hook-form";
import { ArrowLeft, Sparkles } from "lucide-react";
import { DescribeForm, getSubtypeLabel } from "../IntakeWizard";
import { CategoryId } from "../intakeConstants";

interface DescribeStepProps {
  form: UseFormReturn<DescribeForm>;
  category: CategoryId;
  opponentName?: string;
  onSubmit: (data: DescribeForm) => void;
  onBack: () => void;
  isLoading: boolean;
  phaseError: { phase: string; message: string } | null;
  retryAssessment: () => void;
  runAssessmentPending: boolean;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue-light/55">
        {label}
      </label>
      {children}
    </div>
  );
}

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs text-red-500">{msg}</p> : null;
}

function Loader() {
  return <span className="h-4 w-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />;
}

export function DescribeStep({
  form,
  category,
  opponentName,
  onSubmit,
  onBack,
  isLoading,
  phaseError,
  retryAssessment,
  runAssessmentPending,
}: DescribeStepProps) {
  const { register, handleSubmit, formState: { errors } } = form;
  const subtypeLabel = getSubtypeLabel(category);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-6">
      <Field label="Give your case a short title">
        <input
          {...register("title")}
          placeholder={`e.g. ${subtypeLabel} — ${opponentName ?? "party name"}`}
          className="form-input"
        />
        <Err msg={errors.title?.message} />
      </Field>

      <Field label="Anything else you'd like us to know? (optional)">
        <textarea
          {...register("description")}
          rows={5}
          placeholder="Add any extra context, timeline, or details that weren't covered in the form above..."
          className="form-input resize-none"
        />
        <Err msg={errors.description?.message} />
        <p className="mt-1 text-[10px] text-brand-blue-light/40">
          This is optional — the structured details you've already entered are enough for a good assessment.
        </p>
      </Field>

      <div className="rounded-xl border border-brand-gold/12 bg-brand-gold/5 p-4 text-xs leading-6 text-brand-blue-light/60">
        <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-brand-gold" />
        AI will now review everything you've entered and generate your legal assessment.
      </div>

      {phaseError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 space-y-2">
          <p className="text-sm text-red-600">{phaseError.message}</p>
          {phaseError.phase === "assess" && (
            <button
              type="button"
              onClick={retryAssessment}
              disabled={runAssessmentPending}
              className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {runAssessmentPending ? (
                <>
                  <Loader /> Retrying…
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" /> Retry assessment
                </>
              )}
            </button>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-brand-gold/15 px-4 py-2 text-sm font-medium text-brand-blue-light/60 hover:bg-base-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="shimmer-btn flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-blue-dark px-5 py-2.5 text-sm font-semibold text-brand-gold transition-all hover:bg-brand-blue-light disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader /> Reviewing your case…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Get my assessment
            </>
          )}
        </button>
      </div>
    </form>
  );
}
