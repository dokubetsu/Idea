"use client";

import { useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { CoreForm } from "../IntakeWizard";

interface CoreFactsStepProps {
  form: UseFormReturn<CoreForm>;
  onSubmit: (data: CoreForm) => void;
  onBack: () => void;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue-light/50">
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
  const { register, handleSubmit, watch, setValue, formState: { errors } } = form;

  useEffect(() => {
    register("urgency_level");
    register("prior_legal_action");
  }, [register]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-6">
      <p className="text-xs text-brand-blue-light/50">
        These few questions apply to every case. No legal jargon — just tell us what happened.
      </p>

      <Field label="When did this happen?" htmlFor="incident_date">
        <input id="incident_date" type="date" {...register("incident_date")} className="form-input" />
        <Err msg={errors.incident_date?.message} />
      </Field>

      <Field label="Where did this happen? (city and state)" htmlFor="incident_location">
        <input
          id="incident_location"
          type="text"
          placeholder="e.g. Bangalore, Karnataka"
          {...register("incident_location")}
          className="form-input"
        />
        <Err msg={errors.incident_location?.message} />
      </Field>

      <Field label="Who is on the other side? (person or company name)" htmlFor="opponent_name">
        <input
          id="opponent_name"
          type="text"
          placeholder="e.g. Rakesh Sharma or HDFC Bank"
          {...register("opponent_name")}
          className="form-input"
        />
        <Err msg={errors.opponent_name?.message} />
      </Field>

      <div role="group" aria-labelledby="urgency-label" className="space-y-1.5">
        <label id="urgency-label" className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue-light/50">
          How urgent is this?
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(["exploring", "need_help_soon", "court_date_coming"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setValue("urgency_level", v, { shouldValidate: true })}
              className={`flex relative cursor-pointer flex-col gap-1 rounded-xl border p-3 text-left transition-all ${
                watch("urgency_level") === v
                  ? "border-brand-gold bg-brand-gold/8 text-brand-blue-dark"
                  : "border-brand-gold/15 text-brand-blue-light/60 hover:border-brand-gold/30"
              }`}
            >
              <span className="text-[11px] font-semibold leading-4">{urgencyLabel(v)}</span>
            </button>
          ))}
        </div>
        <Err msg={errors.urgency_level?.message} />
      </div>

      <Field label="Preferred language for communication" htmlFor="preferred_language">
        <select id="preferred_language" {...register("preferred_language")} className="form-input">
          {["English", "Hindi", "Telugu", "Tamil", "Kannada", "Marathi", "Bengali"].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </Field>

      <div role="group" aria-labelledby="prior-legal-label" className="space-y-1.5">
        <label id="prior-legal-label" className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue-light/50">
          Has any FIR or court case been filed about this?
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          {(["no", "yes"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setValue("prior_legal_action", v, { shouldValidate: true })}
              className={`flex-1 flex relative cursor-pointer items-center justify-center gap-2 rounded-xl border py-2.5 transition-all ${
                watch("prior_legal_action") === v
                  ? "border-brand-gold bg-brand-gold/8 font-semibold text-brand-blue-dark"
                  : "border-brand-gold/15 text-brand-blue-light/60 hover:border-brand-gold/30"
              }`}
            >
              {v === "yes" ? "Yes" : "No"}
            </button>
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
      </div>

      <Field label="Who is filing this complaint? (Complainant Type)" htmlFor="complainant_type">
        <select id="complainant_type" {...register("complainant_type")} className="form-input">
          <option value="">— Select Type —</option>
          {["Individual", "Proprietorship", "Partnership", "Company"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Err msg={errors.complainant_type?.message} />
      </Field>

      <Field label="Do you have key documents for this case?" htmlFor="has_documents">
        <select id="has_documents" {...register("has_documents")} className="form-input">
          <option value="">— Select Option —</option>
          {["Yes, I have key documents", "Some documents, not all", "No documents"].map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <Err msg={errors.has_documents?.message} />
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
