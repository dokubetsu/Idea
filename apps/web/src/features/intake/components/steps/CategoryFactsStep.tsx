"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { CategoryId, SUBTYPE_FIELDS } from "../IntakeWizard";

interface CategoryFactsStepProps {
  category: CategoryId;
  catFacts: Record<string, string>;
  setCatFacts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onNext: () => void;
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

export function CategoryFactsStep({
  category,
  catFacts,
  setCatFacts,
  onNext,
  onBack,
}: CategoryFactsStepProps) {
  const fields = SUBTYPE_FIELDS[category] || [];

  return (
    <div className="space-y-5 p-6">
      <p className="text-xs text-brand-blue-light/50">
        These details are specific to your type of case. Fill in what you know — skip anything that doesn't apply.
      </p>

      {fields.map((field) => (
        <Field key={field.key} label={field.label}>
          {field.type === "yesno" ? (
            <div className="flex flex-col sm:flex-row gap-3">
              {["yes", "no"].map((v) => (
                <label
                  key={v}
                  className={`flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-xl border py-2.5 transition-all ${
                    catFacts[field.key] === v
                      ? "border-brand-gold bg-brand-gold/8 font-semibold text-brand-blue-dark"
                      : "border-brand-gold/15 text-brand-blue-light/60 hover:border-brand-gold/30"
                  }`}
                >
                  <input
                    type="radio"
                    name={field.key}
                    value={v}
                    checked={catFacts[field.key] === v}
                    onChange={() => setCatFacts((p) => ({ ...p, [field.key]: v }))}
                    className="sr-only"
                  />
                  {v === "yes" ? "Yes" : "No"}
                </label>
              ))}
            </div>
          ) : field.type === "select" ? (
            <select
              value={catFacts[field.key] ?? ""}
              onChange={(e) => setCatFacts((p) => ({ ...p, [field.key]: e.target.value }))}
              className="form-input"
            >
              <option value="">— Select —</option>
              {field.options?.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
              placeholder={field.placeholder}
              value={catFacts[field.key] ?? ""}
              onChange={(e) => setCatFacts((p) => ({ ...p, [field.key]: e.target.value }))}
              className="form-input"
            />
          )}
        </Field>
      ))}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-brand-gold/15 px-4 py-2 text-sm font-medium text-brand-blue-light/60 hover:bg-base-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="shimmer-btn flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-semibold text-brand-blue-dark transition-all hover:bg-brand-gold-light"
        >
          <ArrowRight className="h-4 w-4" /> Continue
        </button>
      </div>
    </div>
  );
}
