/**
 * Docket feature — TypeScript types for all docket entities.
 *
 * Two type families per entity:
 * - Full (lawyer/admin) types include all fields
 * - Client types OMIT privileged fields entirely (not optional — absent)
 */

// ── Time Entries (lawyer-only) ──────────────────────────────────

export interface TimeEntry {
  id: string;
  matter_id: string;
  lawyer_id: string;
  activity: string;
  hours: number;
  rate_per_hour: number | null;
  amount_inr: number | null;
  entry_date: string;
  status: "unbilled" | "billed" | "written_off";
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Invoices ────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  matter_id: string;
  invoice_number: string;
  period_start: string | null;
  period_end: string | null;
  subtotal_inr: number;
  gst_percent: number;
  gst_amount_inr: number;
  total_inr: number;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  due_date: string | null;
  paid_at: string | null;
  work_summary: string | null;
  created_at: string;
  updated_at: string;
}

// Client sees a stripped-down invoice
export interface InvoiceClient {
  id: string;
  invoice_number: string;
  period_start: string | null;
  period_end: string | null;
  total_inr: number;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  due_date: string | null;
  paid_at: string | null;
  work_summary: string | null;
}

// ── Disbursements ───────────────────────────────────────────────

export interface Disbursement {
  id: string;
  matter_id: string;
  invoice_id: string | null;
  description: string;
  amount_inr: number;
  incurred_on: string;
  created_at: string;
}

// ── Tasks ───────────────────────────────────────────────────────

export interface CaseTask {
  id: string;
  matter_id: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Timeline Events ─────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  matter_id: string;
  event_type: string;
  description: string; // role-filtered by backend
  occurred_at: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ── Internal Notes (lawyer-only) ────────────────────────────────

export interface InternalNote {
  id: string;
  matter_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// ── Fee Arrangements ────────────────────────────────────────────

export interface FeeArrangement {
  id: string;
  matter_id: string;
  type: "hourly" | "fixed" | "retainer" | "contingency";
  rate_per_hour: number | null;
  fixed_amount: number | null;
  retainer_amount: number | null;
  retainer_used: number | null;
  description: string | null;
  engagement_doc_path: string | null;
  created_at: string;
  updated_at: string;
}

// ── Dashboard Types ─────────────────────────────────────────────

export interface KpiCard {
  value: string;
  caption: string;
  trend: string | null;
}

export interface HearingRow {
  id: string;
  matter_id: string;
  time: string;
  court: string | null;
  case_name: string;
  judge: string | null;
  purpose: string | null;
}

export interface AttentionItem {
  id: string;
  matter_id: string;
  type: "limitation_warning" | "upcoming_hearing" | "overdue" | "unread_message" | "pending_signature";
  severity: "danger" | "warning" | "info";
  message: string;
}

export interface CaseCard {
  id: string;
  client_name: string;
  case_name: string;
  case_number: string | null;
  stage: string;
  next_hearing_at: string | null;
  next_hearing_countdown: string | null;
  is_urgent: boolean;
  client_avatar: string | null;
  matter_health: string | null;
  category: string;
}

export interface LawyerDashboard {
  greeting: string;
  date_display: string;
  summary_line: string;
  kpis: KpiCard[];
  today_hearings: HearingRow[];
  attention_items: AttentionItem[];
  cases: CaseCard[];
}

// ── Client Dashboard Types ──────────────────────────────────────

export interface ClientCase {
  id: string;
  title: string;
  plain_title: string;
  status_text: string;
  stage: "filed" | "reply" | "evidence" | "arguments" | "judgment";
  case_number: string | null;
  court_name: string | null;
  category: string | null;
  lawyer_name: string | null;
  lawyer_avatar: string | null;
  next_hearing_date: string | null;
  next_hearing_description: string | null;
  next_hearing_attend: boolean;
  stats?: {
    hearings_count: number;
    documents_count: number;
    months_running: number;
  };
}

export interface ClientTask {
  id: string;
  title: string;
  due_date: string | null;
  is_overdue: boolean;
}

export interface ClientTimelineEntry {
  id: string;
  description: string;
  occurred_at: string;
}

export interface ClientDashboard {
  greeting: string;
  date_display: string;
  case: ClientCase | null;
  cases: ClientCase[];
  pending_tasks: ClientTask[];
  recent_updates: ClientTimelineEntry[];
  stats: {
    hearings_count: number;
    documents_count: number;
    months_running: number;
  };
}

// ── Billing Types ───────────────────────────────────────────────

export interface LawyerBilling {
  role: "lawyer";
  unbilled_wip: number;
  billed_ar: number;
  paid_to_date: number;
  trust_balance: number;
  has_overdue: boolean;
  fee_arrangement: FeeArrangement | null;
  unbilled_entries: TimeEntry[];
  invoices: Invoice[];
  disbursements: Disbursement[];
}

export interface ClientBilling {
  role: "client";
  amount_due: number;
  amount_due_invoice: string | null;
  days_overdue: number | null;
  retainer_amount: number | null;
  retainer_used: number | null;
  paid_to_date: number;
  fee_description: string | null;
  engagement_doc_path: string | null;
  invoices: InvoiceClient[];
}

// ── AI Chat ─────────────────────────────────────────────────────

export interface AiChatResponse {
  response: string;
  sources: string[];
  case_id: string;
}

export interface Hearing {
  id: string;
  matter_id: string;
  hearing_date: string;
  courtroom: string | null;
  judge: string | null;
  purpose: string | null;
  status: "scheduled" | "completed" | "adjourned" | "cancelled";
  outcome: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  matter_id: string;
  name: string;
  path: string;
  mime_type: string | null;
  size_bytes: number | null;
  visibility: "public" | "lawyer_only";
  review_status: "pending" | "approved" | "rejected";
  lawyer_note: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface DocumentRequest {
  id: string;
  matter_id: string;
  title: string;
  description: string | null;
  label: string;
  status: "pending" | "fulfilled" | "cancelled";
  document_id: string | null;
  requested_by: string;
  created_at: string;
}

export interface Message {
  id: string;
  matter_id: string;
  sender_id: string;
  content: string;
  message_type: "standard" | "system";
  attachment_path: string | null;
  read_at: string | null;
  created_at: string;
}

// ── Case Overview ───────────────────────────────────────────────

export interface LawyerCaseOverview {
  role: "lawyer";
  matter_id: string;
  case_facts: {
    case_number: string | null;
    court: string | null;
    category: string;
    filed_date: string | null;
    wip: number;
    plaintiff: {
      name: string;
      contact: {
        phone: string | null;
        city: string | null;
      } | null;
    };
  };
  deadline_alert: string | null;
  next_hearing: {
    id: string;
    hearing_date: string;
    days_until: number | null;
    courtroom: string | null;
    judge: string | null;
    purpose: string | null;
  } | null;
  client_uploads: Array<{ id: string; name: string; created_at: string }>;
  client_pending_tasks: Array<{ id: string; title: string; due_date: string | null }>;
  recent_activity: Array<{ id: string; description: string; occurred_at: string }>;
  my_tasks: Array<{ id: string; title: string; due_date: string | null; is_completed: boolean }>;
  internal_notes: Array<{ id: string; content: string; created_at: string }>;
}

export interface ClientCaseOverview {
  role: "client";
  matter_id: string;
  stage: string;
  status_text: string;
  case_facts: {
    case_number: string | null;
    court: string | null;
    category: string | null;
    filed_date: string | null;
    stage: string;
    lawyer_name: string | null;
  };
  lawyer: {
    name: string;
    avatar: string | null;
  } | null;
  next_hearing: {
    date: string;
    description: string;
    attend: boolean;
  } | null;
  pending_tasks: Array<{ id: string; title: string; due_date: string | null; is_overdue: boolean }>;
  recent_updates: Array<{ id: string; description: string; occurred_at: string }>;
  documents: Array<{ id: string; name: string; created_at: string }>;
  stats: {
    hearings_count: number;
    documents_count: number;
    months_running: number;
  };
}

export type CaseOverview = LawyerCaseOverview | ClientCaseOverview;