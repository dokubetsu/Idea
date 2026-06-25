"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle, ArrowLeft, ArrowRight, BookOpen,
  CheckCircle, Clock, DollarSign, FileText, Gavel,
  Scale, Sparkles, X, Zap, ChevronRight
} from "lucide-react";
import {
  useStartIntake, useUpdateFacts, useRunAssessment, useCommitIntake,
} from "@/features/intake/hooks/useIntake";
import type { IntakeSession, Assessment, FactType } from "@/entities/types";

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

// ── Sub-type specific fields ──────────────────────────────────────
type FieldDef = {
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

// ── Description schema ────────────────────────────────────────────
const describeSchema = z.object({
  title:       z.string().min(5, "Min 5 characters").max(200),
  description: z.string().min(10, "Add any extra details that weren't covered above"),
});
type DescribeForm = z.infer<typeof describeSchema>;

// ── Helpers ───────────────────────────────────────────────────────
function toFact(key: string, value: any, label: string, type = "text") {
  const mappedType: FactType = (type === "string" ? "text" : type) as FactType;
  return { key, value, type: mappedType, label, confidence: 1.0, source: "user" };
}

function urgencyLabel(v: string) {
  return { exploring: "Just exploring options", need_help_soon: "I need help soon", court_date_coming: "Court date coming up" }[v] ?? v;
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

  const currentDomainObj = DOMAINS.find(d => d.id === selectedDomain);

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

        {/* ── Step 1: Domain ────────────────────────────────── */}
        {step === "domain" && (
          <div className="p-6 space-y-4">
            <p className="text-sm text-brand-blue-light/60">
              Choose the legal domain that your case falls under. Selecting Legal Notice will open the drafting tool.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {DOMAINS.map((d) => (
                <button key={d.id} type="button" onClick={() => onDomainSelect(d.id)}
                  className="flex flex-col gap-2 rounded-xl border border-brand-gold/12 bg-base-100 p-4 text-left transition-all hover:border-brand-gold/35 hover:bg-brand-gold/5 hover:-translate-y-0.5 hover:shadow-sm group">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{d.icon}</span>
                    <ChevronRight className="h-4 w-4 text-brand-blue-light/20 group-hover:text-brand-gold transition-colors" />
                  </div>
                  <p className="font-semibold text-[13px] text-brand-blue-dark">{d.label}</p>
                  <p className="text-[11px] text-brand-blue-light/50 leading-4">{d.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 1.5: Sub-type ────────────────────────────── */}
        {step === "subtype" && currentDomainObj && (
          <div className="p-6 space-y-4">
            <p className="text-sm text-brand-blue-light/60">
              Select the specific sub-type that best matches your situation.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {currentDomainObj.subtypes.map((sub) => (
                <button key={sub.id} type="button" onClick={() => onSubtypeSelect(sub.id as CategoryId)}
                  className="flex flex-col gap-1 rounded-xl border border-brand-gold/12 bg-base-100 p-4 text-left transition-all hover:border-brand-gold/35 hover:bg-brand-gold/5 hover:-translate-y-0.5 hover:shadow-sm">
                  <p className="font-semibold text-[13px] text-brand-blue-dark">{sub.label}</p>
                  <p className="text-[11px] text-brand-blue-light/50 leading-4">{sub.desc}</p>
                </button>
              ))}
            </div>
            <div className="flex pt-2">
              <button type="button" onClick={() => setStep("domain")}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-gold/15 px-4 py-2 text-sm font-medium text-brand-blue-light/60 hover:bg-base-200 transition-colors">
                <ArrowLeft className="h-4 w-4" /> Back to Domains
              </button>
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
              <div className="flex flex-col sm:flex-row gap-3">
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
              <button type="button" onClick={() => setStep("subtype")}
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

            {(SUBTYPE_FIELDS[category] ?? []).map((field) => (
              <Field key={field.key} label={field.label}>
                {field.type === "yesno" ? (
                  <div className="flex flex-col sm:flex-row gap-3">
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
                placeholder={`e.g. ${getSubtypeLabel(category)} — ${coreFacts?.opponent_name ?? "party name"}`}
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

            {phaseError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 space-y-2">
                <p className="text-sm text-red-600">{phaseError.message}</p>
                {phaseError.phase === "assess" && pendingSession && (
                  <button type="button" onClick={retryAssessment} disabled={runAssessment.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50">
                    {runAssessment.isPending ? <><Loader /> Retrying…</> : <><Sparkles className="h-3 w-3" /> Retry assessment</>}
                  </button>
                )}
              </div>
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
function getSubtypeLabel(id: string | null): string {
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
