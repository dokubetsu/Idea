"use client";

import { useState } from "react";
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

// ── Two-Level Selection Structure ────────────────────────────────
export const DOMAINS = [
  {
    id: "finance",
    label: "Finance",
    icon: "💰",
    desc: "Cheque bounce, bank/online fraud, tax disputes, money recovery",
    subtypes: [
      { id: "cheque_bounce", label: "Cheque Bounce (Sec 138)", desc: "Dishonoured cheques and Section 138 NI Act notices" },
      { id: "bank_fraud", label: "Bank / Online Fraud", desc: "UPI scam, phishing, OTP fraud, card cloning" },
      { id: "tax_dispute", label: "Income Tax Dispute", desc: "Refund pending, excess demand notices, TDS mismatches" },
      { id: "money_recovery", label: "Money Recovery / Loan", desc: "Personal or business loan defaults, promissory notes" },
      { id: "other_finance", label: "Other Financial", desc: "Other financial, banking or debt disputes" },
    ]
  },
  {
    id: "consumer",
    label: "Consumer",
    icon: "🛒",
    desc: "Defective products, service deficiency, e-commerce, insurance",
    subtypes: [
      { id: "product_defect", label: "Product Defect", desc: "Defective appliances, electronics, or vehicles under warranty" },
      { id: "service_deficiency", label: "Service Deficiency", desc: "Deficient telecom, banking, insurance, or internet services" },
      { id: "ecommerce_dispute", label: "E-commerce Dispute", desc: "Refund denied, wrong item, or counterfeit goods online" },
      { id: "insurance_rejection", label: "Insurance Claim Rejected", desc: "Rejected health, life, motor, or travel claims" },
      { id: "medical_negligence", label: "Medical Negligence", desc: "Negligent medical care or hospital malpractice" },
    ]
  },
  {
    id: "rera",
    label: "RERA / Property",
    icon: "🏗️",
    desc: "Delayed flat possession, project cancellation, structural defects",
    subtypes: [
      { id: "delayed_possession", label: "Delayed Possession", desc: "Failure of builder to hand over flat on promised date" },
      { id: "project_cancellation", label: "Project Cancellation", desc: "Cancellation of booking or whole housing project" },
      { id: "structural_defects", label: "Structural Defects", desc: "Poor construction quality or defects noticed post-handover" },
      { id: "amenities_misrepresentation", label: "Misrepresentation / Amenities", desc: "Undelivered amenities promised in brochures" },
    ]
  },
  {
    id: "motor_vehicles",
    label: "Motor Vehicles Act",
    icon: "🚗",
    desc: "Road accidents, injury/death claims, RTO disputes",
    subtypes: [
      { id: "accident_injury", label: "Accident — Personal Injury", desc: "Injuries sustained in road traffic accidents" },
      { id: "accident_death", label: "Accident — Death Claim (MACT)", desc: "Fatal road accident compensation petitions before MACT" },
      { id: "mv_insurance_rejection", label: "Insurance Claim Rejected", desc: "Rejected motor own-damage or third-party claims" },
      { id: "hit_and_run", label: "Hit and Run", desc: "Compensation claims for hit & run under MACT fund" },
      { id: "license_rc_dispute", label: "Driving Licence / RC Dispute", desc: "Suspended licence, RC transfer, or penalty order disputes" },
    ]
  },
  {
    id: "legal_notice",
    label: "Legal Notice",
    icon: "📄",
    desc: "Draft a formal demand or grievance notice to resolve a dispute",
    subtypes: [
      { id: "legal_notice_draft", label: "Legal Notice Service", desc: "Draft a legal notice directly from dashboard" }
    ]
  }
] as const;

export type CategoryId =
  | "cheque_bounce" | "bank_fraud" | "tax_dispute" | "money_recovery" | "other_finance"
  | "product_defect" | "service_deficiency" | "ecommerce_dispute" | "insurance_rejection" | "medical_negligence"
  | "delayed_possession" | "project_cancellation" | "structural_defects" | "amenities_misrepresentation"
  | "accident_injury" | "accident_death" | "mv_insurance_rejection" | "hit_and_run" | "license_rc_dispute";

// ── Sub-type specific fields ──────────────────────────────────────
export type FieldDef = {
  key: string; label: string;
  type: "text" | "number" | "date" | "yesno" | "select";
  placeholder?: string; options?: string[];
};

export const SUBTYPE_FIELDS: Record<CategoryId, FieldDef[]> = {
  cheque_bounce: [
    { key: "cheque_amount",       label: "Amount on the cheque (₹)",            type: "number", placeholder: "e.g. 75000" },
    { key: "cheque_date",         label: "Date written on the cheque",            type: "date" },
    { key: "dishonour_date",      label: "Date it was returned / bounced",        type: "date" },
    { key: "dishonour_reason",    label: "Reason for dishonour",                  type: "select",
      options: ["Insufficient funds", "Payment stopped", "Account closed", "Signature mismatch", "Other"] },
    { key: "payee_name",          label: "Payee name",                            type: "text",   placeholder: "e.g. Suresh Kumar" },
    { key: "bank_name",           label: "Bank name",                            type: "text",   placeholder: "e.g. HDFC Bank" },
    { key: "branch_name",         label: "Branch name",                          type: "text",   placeholder: "e.g. MG Road Branch" },
    { key: "legal_notice_sent",   label: "Has a legal notice been sent?",         type: "yesno" },
    { key: "notice_sent_date",    label: "Notice sent date (if applicable)",      type: "date" },
    { key: "response_15days",     label: "Has 15-day response deadline elapsed?", type: "yesno" },
    { key: "underlying_debt_type",label: "What was the cheque for?",              type: "select",
      options: ["Loan repayment", "Service payment", "Goods payment", "Security deposit", "Other"] },
  ],
  bank_fraud: [
    { key: "fraud_type",          label: "Fraud type",                            type: "select",
      options: ["Phishing", "OTP fraud", "UPI fraud", "Card clone", "Account takeover", "Ponzi", "Other"] },
    { key: "amount_defrauded",    label: "Amount defrauded (₹)",                  type: "number", placeholder: "e.g. 15000" },
    { key: "fraud_date",          label: "Date of fraud",                         type: "date" },
    { key: "bank_name",           label: "Bank name",                            type: "text",   placeholder: "e.g. ICICI Bank" },
    { key: "transaction_ref",     label: "Transaction reference / UTR",           type: "text",   placeholder: "e.g. UTR1234567" },
    { key: "cybercrime_complaint",label: "Cybercrime complaint filed?",            type: "yesno" },
    { key: "complaint_number",    label: "Complaint number (if filed)",           type: "text",   placeholder: "e.g. 1002345" },
    { key: "bank_response",       label: "Bank response received?",               type: "yesno" },
  ],
  tax_dispute: [
    { key: "assessment_year",     label: "Assessment year",                       type: "text",   placeholder: "e.g. AY 2024-25" },
    { key: "issue_type",          label: "Issue type",                            type: "select",
      options: ["Excess demand", "Refund pending", "Notice received", "Penalty", "TDS mismatch"] },
    { key: "amount_disputed",     label: "Amount in dispute (₹)",                 type: "number", placeholder: "e.g. 120000" },
    { key: "notice_number",       label: "Notice/Order number",                   type: "text",   placeholder: "e.g. DIN-12345" },
    { key: "auditor_involved",    label: "Is a CA/Auditor involved?",             type: "yesno" },
    { key: "previous_appeal",     label: "Previous appeal filed?",                type: "yesno" },
  ],
  money_recovery: [
    { key: "loan_type",           label: "Type of loan/debt",                     type: "select",
      options: ["Personal loan", "Business loan", "Promissory note", "Part payment", "Other"] },
    { key: "amount_lent",         label: "Amount lent (₹)",                        type: "number", placeholder: "e.g. 300000" },
    { key: "date_lent",           label: "Date lent",                             type: "date" },
    { key: "repayment_date",      label: "Agreed repayment date",                 type: "date" },
    { key: "docs_available",      label: "Documents available (e.g. agreement)",   type: "text",   placeholder: "e.g. Written agreement, bank proof" },
    { key: "partial_payment",     label: "Partial payment received?",             type: "yesno" },
    { key: "amount_received",     label: "Amount received so far (₹)",            type: "number", placeholder: "e.g. 50000" },
  ],
  other_finance: [
    { key: "dispute_type",        label: "Describe the nature of the dispute",    type: "text",   placeholder: "e.g. Dispute over credit card charges" },
    { key: "amount_involved",     label: "Amount involved (₹)",                   type: "number", placeholder: "e.g. 35000" },
  ],
  product_defect: [
    { key: "product_name",        label: "Product name",                          type: "text",   placeholder: "e.g. Smart TV" },
    { key: "brand",               label: "Brand",                                 type: "text",   placeholder: "e.g. Sony" },
    { key: "purchase_amount",     label: "Purchase amount (₹)",                   type: "number", placeholder: "e.g. 45000" },
    { key: "purchase_date",       label: "Purchase date",                         type: "date" },
    { key: "purchase_channel",    label: "Purchase channel",                      type: "select",
      options: ["Online", "Retail store", "Direct from brand"] },
    { key: "defect_description",  label: "Defect description",                    type: "text",   placeholder: "e.g. Screen line issue within 1 month" },
    { key: "complaint_sent",      label: "Complaint sent to seller/brand?",       type: "yesno" },
    { key: "complaint_date",      label: "Complaint date",                        type: "date" },
    { key: "company_response",    label: "Company response",                      type: "text",   placeholder: "e.g. Replacement denied" },
    { key: "warranty_valid",      label: "Is the warranty still valid?",          type: "yesno" },
  ],
  service_deficiency: [
    { key: "service_type",        label: "Service type",                          type: "select",
      options: ["Telecom", "Banking", "Insurance", "Electricity", "Internet", "Education", "Other"] },
    { key: "provider_name",       label: "Provider name",                         type: "text",   placeholder: "e.g. Airtel" },
    { key: "issue_description",   label: "Issue description",                     type: "text",   placeholder: "e.g. Broad band down for 10 days" },
    { key: "amount_paid",         label: "Amount paid (₹)",                       type: "number", placeholder: "e.g. 2400" },
    { key: "complaint_sent",      label: "Complaint sent?",                       type: "yesno" },
    { key: "complaint_date",      label: "Date of complaint",                     type: "date" },
  ],
  ecommerce_dispute: [
    { key: "platform",            label: "Platform",                              type: "select",
      options: ["Amazon", "Flipkart", "Meesho", "Myntra", "Other"] },
    { key: "order_id",            label: "Order ID",                              type: "text",   placeholder: "e.g. OD-998877" },
    { key: "order_amount",        label: "Order amount (₹)",                      type: "number", placeholder: "e.g. 1500" },
    { key: "issue",               label: "Issue",                                 type: "select",
      options: ["Not delivered", "Wrong item", "Refund denied", "Damaged", "Counterfeit"] },
    { key: "purchase_date",       label: "Date of purchase",                      type: "date" },
    { key: "refund_requested",    label: "Refund requested?",                     type: "yesno" },
    { key: "amount_disputed",     label: "Amount in dispute (₹)",                 type: "number", placeholder: "e.g. 1500" },
  ],
  insurance_rejection: [
    { key: "insurance_type",      label: "Insurance type",                        type: "select",
      options: ["Health", "Motor", "Life", "Home", "Travel"] },
    { key: "insurance_company",   label: "Insurance company",                     type: "text",   placeholder: "e.g. Star Health" },
    { key: "policy_number",       label: "Policy number",                         type: "text",   placeholder: "e.g. STAR-9988" },
    { key: "claim_amount",        label: "Claim amount (₹)",                      type: "number", placeholder: "e.g. 150000" },
    { key: "reason_for_rejection",label: "Reason for rejection",                  type: "text",   placeholder: "e.g. Pre-existing disease exclusion" },
    { key: "date_of_rejection",   label: "Date of rejection",                     type: "date" },
    { key: "date_of_incident",    label: "Date of incident",                      type: "date" },
  ],
  medical_negligence: [
    { key: "hospital_doctor_name",label: "Hospital/Doctor name",                  type: "text",   placeholder: "e.g. Apollo Hospital" },
    { key: "negligence_nature",   label: "Nature of negligence",                  type: "text",   placeholder: "e.g. Gauze left during surgery" },
    { key: "treatment_date",      label: "Date of treatment",                     type: "date" },
    { key: "harm_caused",         label: "Harm caused",                           type: "text",   placeholder: "e.g. Severe internal infection" },
    { key: "medical_bills",       label: "Medical bills incurred (₹)",            type: "number", placeholder: "e.g. 350000" },
    { key: "complaint_to_hospital",label: "Complaint to hospital?",               type: "yesno" },
    { key: "complaint_to_council", label: "Complaint to Medical Council?",         type: "yesno" },
  ],
  delayed_possession: [
    { key: "project_name",        label: "Project name",                          type: "text",   placeholder: "e.g. DLF Heights" },
    { key: "builder_name",        label: "Builder name",                          type: "text",   placeholder: "e.g. DLF Ltd" },
    { key: "rera_registration",   label: "RERA registration number",              type: "text",   placeholder: "e.g. RERA-12345" },
    { key: "flat_number",         label: "Flat/unit number",                      type: "text",   placeholder: "e.g. B-402" },
    { key: "total_flat_cost",     label: "Total flat cost (₹)",                   type: "number", placeholder: "e.g. 7500000" },
    { key: "amount_paid",         label: "Amount paid so far (₹)",                type: "number", placeholder: "e.g. 5000000" },
    { key: "promised_possession_date", label: "Promised possession date",         type: "date" },
    { key: "current_status",      label: "Current status",                        type: "select",
      options: ["Under construction", "Abandoned", "Partial handover"] },
    { key: "demand_letters_sent", label: "Demand letters sent to builder?",       type: "yesno" },
    { key: "state_rera",          label: "State RERA authority",                  type: "text",   placeholder: "e.g. Karnataka RERA" },
  ],
  project_cancellation: [
    { key: "project_name",        label: "Project name",                          type: "text",   placeholder: "e.g. Prestige Lakeview" },
    { key: "builder_name",        label: "Builder",                               type: "text",   placeholder: "e.g. Prestige Group" },
    { key: "booking_amount",      label: "Booking amount paid (₹)",               type: "number", placeholder: "e.g. 500000" },
    { key: "cancellation_date",   label: "Date of cancellation",                  type: "date" },
    { key: "refund_received",     label: "Refund received?",                      type: "yesno" },
    { key: "amount_refunded",     label: "Amount refunded (₹)",                   type: "number", placeholder: "e.g. 200000" },
    { key: "cancellation_reason",  label: "Reason given by builder",               type: "text",   placeholder: "e.g. Clearances rejected" },
  ],
  structural_defects: [
    { key: "project_name",        label: "Project name",                          type: "text",   placeholder: "e.g. Sobha Royal" },
    { key: "builder_name",        label: "Builder",                               type: "text",   placeholder: "e.g. Sobha Ltd" },
    { key: "possession_date",     label: "Possession date received",              type: "date" },
    { key: "defect_description",  label: "Defect description",                    type: "text",   placeholder: "e.g. Wall seepage and structural cracks" },
    { key: "defect_noticed_date", label: "Defect noticed date",                   type: "date" },
    { key: "repair_demanded",     label: "Repair demanded?",                      type: "yesno" },
    { key: "builder_responded",   label: "Builder responded?",                      type: "yesno" },
  ],
  amenities_misrepresentation: [
    { key: "project_name",        label: "Project name",                          type: "text",   placeholder: "e.g. Godrej Eternity" },
    { key: "builder_name",        label: "Builder",                               type: "text",   placeholder: "e.g. Godrej Properties" },
    { key: "promised_amenity",    label: "Promised amenity",                      type: "text",   placeholder: "e.g. Clubhouse and pool" },
    { key: "what_not_delivered",  label: "What was not delivered",                type: "text",   placeholder: "e.g. Clubhouse and pool" },
    { key: "brochure_available",  label: "Brochure/agreement available?",         type: "yesno" },
  ],
  accident_injury: [
    { key: "accident_date",       label: "Accident date",                         type: "date" },
    { key: "accident_location",   label: "Accident location",                     type: "text",   placeholder: "e.g. Outer Ring Road, Delhi" },
    { key: "your_role",           label: "Your role",                             type: "select",
      options: ["Driver", "Pedestrian", "Passenger", "Bystander"] },
    { key: "vehicle_involved",    label: "Vehicle involved (type + registration)",type: "text",   placeholder: "e.g. Sedan (DL-3C-XX-XXXX)" },
    { key: "fir_filed",           label: "FIR filed?",                            type: "yesno" },
    { key: "fir_number",          label: "FIR number",                            type: "text",   placeholder: "e.g. FIR/123/2025" },
    { key: "police_station",      label: "Police station",                        type: "text",   placeholder: "e.g. Saket Police Station" },
    { key: "injuries_sustained",  label: "Injuries sustained",                    type: "select",
      options: ["Minor", "Moderate", "Serious", "Permanent disability", "Fatal"] },
    { key: "hospital_treatment",  label: "Hospital treatment taken?",             type: "yesno" },
    { key: "hospital_name",       label: "Hospital name",                         type: "text",   placeholder: "e.g. Max Hospital" },
    { key: "medical_expenses",    label: "Medical expenses incurred (₹)",          type: "number", placeholder: "e.g. 85000" },
    { key: "income_lost",         label: "Income lost per month (₹)",              type: "number", placeholder: "e.g. 45000" },
    { key: "insurance_claim_filed",label: "Insurance claim filed with own insurer?",type: "yesno" },
  ],
  accident_death: [
    { key: "accident_date",       label: "Accident date",                         type: "date" },
    { key: "deceased_name",       label: "Deceased name",                         type: "text",   placeholder: "e.g. Ramesh Verma" },
    { key: "relationship_to_claimant", label: "Relationship to claimant",         type: "text",   placeholder: "e.g. Spouse / Dependent child" },
    { key: "fir_number",          label: "FIR number",                            type: "text",   placeholder: "e.g. FIR/456/2025" },
    { key: "dependents",          label: "Are there dependents?",                  type: "yesno" },
    { key: "dependents_count",    label: "Number of dependants",                  type: "number", placeholder: "e.g. 3" },
    { key: "deceased_income",     label: "Deceased's monthly income (₹)",          type: "number", placeholder: "e.g. 60000" },
    { key: "offending_vehicle_insurance", label: "Insurance details of offending vehicle", type: "text", placeholder: "e.g. National Insurance" },
  ],
  mv_insurance_rejection: [
    { key: "insurance_company",   label: "Insurance company",                     type: "text",   placeholder: "e.g. ICICI Lombard" },
    { key: "policy_number",       label: "Policy number",                         type: "text",   placeholder: "e.g. M-998877" },
    { key: "claim_type",          label: "Claim type",                            type: "select",
      options: ["Own damage", "Third party", "Comprehensive"] },
    { key: "vehicle_registration",label: "Vehicle registration",                  type: "text",   placeholder: "e.g. KA-03-XX-YYYY" },
    { key: "reason_for_rejection",label: "Reason for rejection",                  type: "text",   placeholder: "e.g. Unauthorized driver license" },
    { key: "claim_amount",        label: "Claim amount (₹)",                      type: "number", placeholder: "e.g. 95000" },
    { key: "date_of_rejection",   label: "Date of rejection",                     type: "date" },
  ],
  hit_and_run: [
    { key: "accident_date",       label: "Date",                                  type: "date" },
    { key: "accident_location",   label: "Location",                              type: "text",   placeholder: "e.g. Hosur Road, Bangalore" },
    { key: "vehicle_description", label: "Vehicle description (if known)",        type: "text",   placeholder: "e.g. Black SUV" },
    { key: "fir_filed",           label: "FIR filed?",                            type: "yesno" },
    { key: "police_station",      label: "Police station",                        type: "text",   placeholder: "e.g. Electronic City PS" },
    { key: "injuries_fatality",   label: "Injuries / fatality",                   type: "text",   placeholder: "e.g. Serious leg fracture" },
    { key: "mact_compensation_applied", label: "Hit & Run compensation applied (MACT Fund)?", type: "yesno" },
  ],
  license_rc_dispute: [
    { key: "dispute_type",        label: "Dispute type",                          type: "select",
      options: ["Licence suspended", "RC cancelled", "Penalty dispute", "Transfer dispute"] },
    { key: "authority_involved",  label: "Authority involved (RTO name)",          type: "text",   placeholder: "e.g. Indiranagar RTO" },
    { key: "notice_received",     label: "Notice received?",                      type: "yesno" },
    { key: "order_date",          label: "Date of order",                         type: "date" },
  ],
};

// ── Core facts schema (always collected) ─────────────────────────
export const coreSchema = z.object({
  incident_date:      z.string().min(1, "Required"),
  incident_location:  z.string().min(2, "Required"),
  opponent_name:      z.string().min(2, "Required"),
  urgency_level:      z.enum(["exploring", "need_help_soon", "court_date_coming"]),
  preferred_language: z.enum(["Hindi", "English", "Telugu", "Tamil", "Kannada", "Marathi", "Bengali"]),
  prior_legal_action: z.enum(["yes", "no"]),
  prior_legal_detail: z.string().optional(),
});
export type CoreForm = z.infer<typeof coreSchema>;

// ── Description schema ────────────────────────────────────────────
export const describeSchema = z.object({
  title:       z.string().min(5, "Min 5 characters").max(200),
  description: z.string().min(10, "Add any extra details that weren't covered above"),
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
    const description = data.description || "See structured facts.";

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
