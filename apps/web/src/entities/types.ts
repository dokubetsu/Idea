// ── Domain types — mirrors backend schemas ────────────────────────

export type UserRole    = "user" | "lawyer" | "admin";
export type MatterStatus = "draft"|"intake"|"assessment"|"matching"|"active"|"resolved"|"archived";
export type MatterHealthStatus = "waiting_on_client"|"waiting_on_lawyer"|"waiting_on_court"|"in_progress";
export type MatterCategory = "consumer"|"cheque_bounce"|"property"|"family"|"labour"|"criminal"|"cyber"|"rera"|"other";
export type MatterPriority = "low"|"medium"|"high"|"urgent";
export type ConsultationPackage = "free" | "starter" | "full";
export type ConsultationStatus = "pending" | "confirmed" | "completed" | "cancelled" | "declined";
export type ConsultationPaymentStatus = "unpaid" | "paid" | "waived";

export interface Profile {
  id: string; role: UserRole; full_name: string;
  phone?: string; city?: string; state?: string;
  avatar_url?: string; is_active: boolean; created_at: string;
}

export interface Fact {
  id: string; matter_id: string;
  key: string; value: string; value_type: string;
  label?: string; source: string; confidence: number;
  is_verified: boolean; created_at: string;
}

export interface Hearing {
  id: string;
  matter_id: string;
  hearing_date: string;
  courtroom?: string;
  judge?: string;
  purpose?: string;
  notes?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  matter_id: string;
  title: string;
  description?: string;
  order_index: number;
  status: string; // 'pending' | 'current' | 'completed'
  amount_inr?: number;
  is_paid?: boolean;
  payment_gateway_ref?: string;
  payment_record_id?: string;
  payment_idempotency_key?: string | null;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  matter_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string; // 'scheduled' | 'completed' | 'cancelled'
  meeting_link?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Matter {
  id: string;
  user_id?: string; // Optional for uncompleted claim flow
  lawyer_id?: string;
  title: string;
  summary: string;
  category: MatterCategory;
  status: MatterStatus;
  priority: MatterPriority;
  matter_health: MatterHealthStatus;
  court_name?: string;
  case_number?: string;
  next_hearing_at?: string;
  assigned_at?: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  lawyer_name?: string;
  client_email?: string;
  client_phone?: string;
  facts: Fact[];
  hearings: Hearing[];
  milestones: Milestone[];
  meetings: Meeting[];
}

export interface MatterUpdate {
  id: string;
  matter_id: string;
  author_id: string;
  author_name?: string;
  content: string;
  is_internal: boolean;
  parent_id?: string;
  created_at: string;
  replies: MatterUpdate[];
}

export interface MatterEvent {
  id: string; matter_id: string; actor_id?: string;
  event_type: string; payload: Record<string, unknown>; created_at: string;
}

export interface LawyerProfile {
  id: string; full_name?: string; city?: string; state?: string;
  avatar_url?: string; bar_council_id?: string;
  specializations: string[]; court_types: string[]; languages: string[];
  experience_years: number; bio?: string; consultation_fee?: number;
  is_verified: boolean; is_available: boolean; rating: number; total_matters: number;
  offers_free_consultation?: boolean;
  offered_packages?: ConsultationPackage[];
}

export type FactType = "text" | "number" | "boolean" | "date" | "array";
export type FactValue = string | number | boolean | string[] | number[] | null;

export interface IntakeSession {
  id: string;
  step: string;
  raw_description?: string;
  extracted_facts: {
    title?: string;
    detected_category?: string;
    completeness_score?: number;
    missing_keys?: string[];
    facts?: Array<{ key: string; value: FactValue; type: FactType; label: string; confidence?: number; source?: string }>;
    schema_version?: number;
  };
  assessment_result?: Assessment;
  completeness_score?: number;
  missing_keys?: string[];
  provider_used?: string;
  is_committed: boolean;
  matter_id?: string;
  created_at: string;
}

export interface Assessment {
  category: string; risk_level: string; success_probability: number;
  success_rationale: string;
  timeline_min_months: number; timeline_max_months: number;
  budget_min_inr: number; budget_max_inr: number;
  key_statutes: string[]; immediate_actions: string[];
  evidence_needed: string[]; recommended_forum: string;
  limitation_risk?: string; complexity: string; notes: string; provider: string;
}

export interface AdminStats {
  total_users: number; total_lawyers: number; total_matters: number;
  open_matters: number; pending_verifications: number; total_facts: number;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  data: Record<string, unknown>;
  action?: {
    label: string;
    url: string;
  };
  status: "unread" | "read" | "dismissed";
  created_at: string;
  idempotency_key?: string | null;
}

export type NotificationChannel = "email" | "sms" | "in_app";
export type NotificationType =
  | "matter_assigned"
  | "hearing_scheduled"
  | "milestone_completed"
  | "comment_added"
  | "generic";

export interface NotificationPreference {
  id: string;
  user_id: string;
  type: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}

export interface PreferenceUpdate {
  type: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}

export interface Consultation {
  id: string;
  user_id: string;
  lawyer_id?: string;
  package: ConsultationPackage;
  sessions_total: number;
  sessions_used: number;
  status: ConsultationStatus;
  payment_status: ConsultationPaymentStatus;
  matter_id?: string;
  notes?: string;
  scheduled_at?: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  lawyer_name?: string;
}

export interface PendingLawyer {
  id: string;
  bar_council_id?: string;
  enrollment_state?: string;
  experience_years?: number;
  specializations?: string[];
  profiles: {
    full_name: string;
    city: string;
    state: string;
    phone: string;
    created_at: string;
  };
}

export interface AdminMatter {
  id: string;
  title: string;
  category: string;
  status: string;
  created_at: string;
  up?: {
    full_name: string;
  };
  lp?: {
    full_name: string;
  };
}
