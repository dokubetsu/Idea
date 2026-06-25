"use client";

import { UseFormReturn } from "react-hook-form";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { CoreForm } from "../IntakeWizard";

interface CoreFactsStepProps {
  form: UseFormReturn<CoreForm>;
  onSubmit: (data: CoreForm) => void;
  onBack: () => void;
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

function urgencyLabel(v: string) {
  return (
    {
      exploring: "Just exploring options",
      need_help_soon: "I need help soon",
      court_date_coming: "Court date coming up",
    }[v] ?? v
  );
}

export function CoreFactsStep({ form, onSubmit, onBack }: CoreFactsStepProps) {
  const { register, handleSubmit, watch, formState: { errors } } = form;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-6">
      <p className="text-xs text-brand-blue-light/50">
        These few questions apply to every case. No legal jargon — just tell us what happened.
      </p>

      <Field label="When did this happen?">
        <input type="date" {...register("incident_date")} className="form-input" />
        <Err msg={errors.incident_date?.message} />
      </Field>

      <Field label="Where did this happen? (city and state)">
        <input
          type="text"
          placeholder="e.g. Bangalore, Karnataka"
          {...register("incident_location")}
          className="form-input"
        />
        <Err msg={errors.incident_location?.message} />
      </Field>

      <Field label="Who is on the other side? (person or company name)">
        <input
          type="text"
          placeholder="e.g. Rakesh Sharma or HDFC Bank"
          {...register("opponent_name")}
          className="form-input"
        />
        <Err msg={errors.opponent_name?.message} />
      </Field>

      <Field label="How urgent is this?">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(["exploring", "need_help_soon", "court_date_coming"] as const).map((v) => (
            <label
              key={v}
              className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-all ${
                watch("urgency_level") === v
                  ? "border-brand-gold bg-brand-gold/8 text-brand-blue-dark"
                  : "border-brand-gold/15 text-brand-blue-light/60 hover:border-brand-gold/30"
              }`}
            >
              <input type="radio" value={v} {...register("urgency_level")} className="sr-only" />
              <span className="text-[11px] font-semibold leading-4">{urgencyLabel(v)}</span>
            </label>
          ))}
        </div>
        <Err msg={errors.urgency_level?.message} />
      </Field>

      <Field label="Preferred language for communication">
        <select {...register("preferred_language")} className="form-input">
          {["English", "Hindi", "Telugu", "Tamil", "Kannada", "Marathi", "Bengali"].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Has any FIR or court case been filed about this?">
        <div className="flex flex-col sm:flex-row gap-3">
          {(["no", "yes"] as const).map((v) => (
            <label
              key={v}
              className={`flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-xl border py-2.5 transition-all ${
                watch("prior_legal_action") === v
                  ? "border-brand-gold bg-brand-gold/8 font-semibold text-brand-blue-dark"
                  : "border-brand-gold/15 text-brand-blue-light/60 hover:border-brand-gold/30"
              }`}
            >
              <input type="radio" value={v} {...register("prior_legal_action")} className="sr-only" />
              {v === "yes" ? "Yes" : "No"}
            </label>
          ))}
        </div>
        {watch("prior_legal_action") === "yes" && (
          <input
            type="text"
            placeholder="Brief details (e.g. FIR at Bandra PS, Case No. 123/2025)"
            {...register("prior_legal_detail")}
            className="form-input mt-2"
          />
        )}
      </Field>

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
          className="shimmer-btn flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-semibold text-brand-blue-dark transition-all hover:bg-brand-gold-light"
        >
          <ArrowRight className="h-4 w-4" /> Continue
        </button>
      </div>
    </form>
  );
}
