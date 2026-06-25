"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FileText, Scale, Copy, Download, ArrowLeft, Check, Sparkles, X, Edit2
} from "lucide-react";
import { createClient } from "@/shared/lib/supabase/client";

// --- Schema definitions ---
const legalNoticeSchema = z.object({
  senderName: z.string().min(2, "Sender name is required"),
  senderAddress: z.string().min(5, "Sender address is required"),
  recipientName: z.string().min(2, "Recipient name is required"),
  recipientAddress: z.string().min(5, "Recipient address is required"),
  subject: z.string().min(5, "Subject/matter is required"),
  noticeType: z.enum([
    "Demand for payment",
    "Property",
    "Consumer",
    "Cheque Bounce",
    "Employment",
    "Breach of Contract",
    "General"
  ]),
  grievance: z.string().min(10, "Please describe the detailed facts or grievance"),
  amountDemanded: z.string().optional(),
  responseDeadline: z.enum(["7 days", "15 days", "30 days", "60 days"]),
  reliefSought: z.string().min(5, "Please specify the relief sought"),
});

type LegalNoticeForm = z.infer<typeof legalNoticeSchema>;

interface LegalNoticeWizardProps {
  onClose: () => void;
}

export default function LegalNoticeWizard({ onClose }: LegalNoticeWizardProps) {
  const [step, setStep] = useState<"form" | "preview">("form");
  const [draftContent, setDraftContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LegalNoticeForm>({
    resolver: zodResolver(legalNoticeSchema),
    defaultValues: {
      noticeType: "General",
      responseDeadline: "15 days",
    }
  });

  const noticeType = watch("noticeType");

  // Autofill sender name from Supabase user metadata
  useEffect(() => {
    setIsClient(true);
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const name = user.user_metadata?.full_name || user.email || "";
        setValue("senderName", name);
      }
    };
    fetchUser();
  }, [setValue]);

  const generateDraft = (data: LegalNoticeForm) => {
    const today = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    const amountText = data.amountDemanded
      ? `\n2. **Financial Claim:** That you are liable to pay a sum of **₹${Number(data.amountDemanded).toLocaleString("en-IN")}** to my client immediately upon receipt of this notice.`
      : "";

    const template = `# LEGAL NOTICE

**Date:** ${today}

**TO,**
**Name:** ${data.recipientName}
**Address:** ${data.recipientAddress}

---

**SUBJECT: LEGAL NOTICE FOR ${data.noticeType.toUpperCase()} — DEMAND FOR PERFORMANCE AND RESOLUTION**

Dear Sir/Madam,

Under instructions from and on behalf of my client, **${data.senderName}**, residing at **${data.senderAddress}**, I hereby serve you with this formal Legal Notice:

1. **Background & Grievance:**
   ${data.grievance}
${amountText}

3. **Required Relief & Demand:**
   ${data.reliefSought}

4. **Deadline for Compliance:**
   You are hereby called upon to comply with the demands or respond in writing to this notice within **${data.responseDeadline}** of receipt. Failing which, my client will be constrained to initiate appropriate legal proceedings against you in the competent court of law, entirely at your risk and consequences as to costs and other liabilities.

Sincerely,

___________________________
**${data.senderName}**
${data.senderAddress}
`.trim();

    setDraftContent(template);
    setStep("preview");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draftContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([draftContent], { type: "text/markdown" });
    element.href = URL.createObjectURL(file);
    element.download = `Legal_Notice_${watch("recipientName").replace(/\s+/g, "_")}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (!isClient) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-gold/15 bg-white shadow-2xl transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-brand-gold/12 bg-gradient-to-r from-base-200/60 to-base-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-blue-dark">
            <FileText className="h-4 w-4 text-brand-gold animate-scale-tilt" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-bold">
              {step === "form" ? "Draft a Legal Notice" : "Review Notice Draft"}
            </h2>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-blue-light/40">
              LeAd · Standalone Service
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-2 text-brand-blue-light/40 hover:bg-base-200 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="custom-scrollbar max-h-[75vh] overflow-y-auto">
        {step === "form" ? (
          <form onSubmit={handleSubmit(generateDraft)} className="space-y-5 p-6">
            <p className="text-xs text-brand-blue-light/50">
              Citizens commonly send legal notices to resolve disputes out of court. Fill in the details to generate a copyable legal notice.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Sender Details */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-gold">Sender (You)</h3>
                <Field label="Your Full Name">
                  <input
                    type="text"
                    {...register("senderName")}
                    className="form-input"
                    placeholder="e.g. Rahul Verma"
                  />
                  {errors.senderName && <p className="mt-1 text-xs text-red-500">{errors.senderName.message}</p>}
                </Field>

                <Field label="Your Address">
                  <textarea
                    {...register("senderAddress")}
                    rows={3}
                    className="form-input resize-none"
                    placeholder="Your complete mailing address"
                  />
                  {errors.senderAddress && <p className="mt-1 text-xs text-red-500">{errors.senderAddress.message}</p>}
                </Field>
              </div>

              {/* Recipient Details */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-gold">Recipient (Noticee)</h3>
                <Field label="Recipient Full Name">
                  <input
                    type="text"
                    {...register("recipientName")}
                    className="form-input"
                    placeholder="e.g. Suresh Kumar"
                  />
                  {errors.recipientName && <p className="mt-1 text-xs text-red-500">{errors.recipientName.message}</p>}
                </Field>

                <Field label="Recipient Address">
                  <textarea
                    {...register("recipientAddress")}
                    rows={3}
                    className="form-input resize-none"
                    placeholder="Recipient's complete address"
                  />
                  {errors.recipientAddress && <p className="mt-1 text-xs text-red-500">{errors.recipientAddress.message}</p>}
                </Field>
              </div>
            </div>

            <hr className="border-brand-gold/12" />

            {/* Matter/Notice details */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-gold">Notice & Grievance Details</h3>
              
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Notice Type">
                  <select {...register("noticeType")} className="form-input">
                    <option value="Demand for payment">Demand for payment</option>
                    <option value="Property">Property Dispute</option>
                    <option value="Consumer">Consumer Complaint</option>
                    <option value="Cheque Bounce">Cheque Bounce (Sec 138)</option>
                    <option value="Employment">Employment Issue</option>
                    <option value="Breach of Contract">Breach of Contract</option>
                    <option value="General">General/Other</option>
                  </select>
                </Field>

                <Field label="Response Deadline">
                  <select {...register("responseDeadline")} className="form-input">
                    <option value="7 days">7 Days</option>
                    <option value="15 days">15 Days (Recommended)</option>
                    <option value="30 days">30 Days</option>
                    <option value="60 days">60 Days</option>
                  </select>
                </Field>
              </div>

              <Field label="Subject / Matter Summary">
                <input
                  type="text"
                  {...register("subject")}
                  className="form-input"
                  placeholder="e.g. Non-payment of professional fees / Failure to deliver flat"
                />
                {errors.subject && <p className="mt-1 text-xs text-red-500">{errors.subject.message}</p>}
              </Field>

              <Field label="Amount Demanded (₹, if applicable)">
                <input
                  type="number"
                  {...register("amountDemanded")}
                  className="form-input"
                  placeholder="e.g. 50000"
                />
              </Field>

              <Field label="Detailed Grievance / Facts">
                <textarea
                  {...register("grievance")}
                  rows={4}
                  className="form-input resize-none"
                  placeholder="Describe the timeline, agreements, dates, and facts of the dispute clearly..."
                />
                {errors.grievance && <p className="mt-1 text-xs text-red-500">{errors.grievance.message}</p>}
              </Field>

              <Field label="Relief / Action Demanded">
                <textarea
                  {...register("reliefSought")}
                  rows={3}
                  className="form-input resize-none"
                  placeholder="e.g. Immediate payment of outstanding dues, handing over flat key, or replacement of goods..."
                />
                {errors.reliefSought && <p className="mt-1 text-xs text-red-500">{errors.reliefSought.message}</p>}
              </Field>
            </div>

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-gold/15 px-4 py-2.5 text-sm font-medium text-brand-blue-light/60 hover:bg-base-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="shimmer-btn flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-semibold text-brand-blue-dark transition-all hover:bg-brand-gold-light"
              >
                <Sparkles className="h-4 w-4" /> Generate Legal Notice
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5 p-6">
            <div className="rounded-xl border border-brand-gold/12 bg-brand-gold/5 p-4 text-xs leading-6 text-brand-blue-light/60">
              <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-brand-gold" />
              Your Legal Notice has been drafted. Please read through, review details, and then copy or download the markdown draft.
            </div>

            <div className="relative rounded-xl border border-brand-gold/12 bg-base-100 p-5 font-mono text-xs leading-relaxed text-brand-blue-dark max-h-[45vh] overflow-y-auto whitespace-pre-wrap">
              {draftContent}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep("form")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-gold/15 px-4 py-2.5 text-sm font-medium text-brand-blue-light/60 hover:bg-base-200 transition-colors"
              >
                <Edit2 className="h-4 w-4" /> Edit Details
              </button>
              
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-brand-teal bg-brand-teal/5 px-4 py-2.5 text-sm font-semibold text-brand-teal transition-all hover:bg-brand-teal/10"
              >
                {copied ? <><Check className="h-4 w-4" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy Draft</>}
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-blue-dark px-4 py-2.5 text-sm font-semibold text-brand-gold transition-all hover:bg-brand-blue-light"
              >
                <Download className="h-4 w-4" /> Download Markdown
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
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
