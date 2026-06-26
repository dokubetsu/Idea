export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  intake: "Setting up",
  assessment: "Being reviewed",
  matching: "Finding a lawyer",
  active: "Active",
  resolved: "Resolved",
  archived: "Archived",
};

export const STATUS_DOT: Record<string, string> = {
  intake: "bg-brand-gold",
  assessment: "bg-brand-accent",
  matching: "bg-brand-accent",
  active: "bg-brand-teal",
  resolved: "bg-brand-teal/60",
  archived: "bg-base-300",
  draft: "bg-base-300",
};

export const STATUS_TONE: Record<string, "gold" | "teal" | "blue" | "muted" | "red"> = {
  draft: "muted",
  intake: "gold",
  assessment: "blue",
  matching: "blue",
  active: "teal",
  resolved: "teal",
  archived: "muted",
};

export const HEALTH_CONFIG: Record<string, { label: string; icon: string; dot: string; bg: string }> = {
  waiting_on_client:  { label: "Action needed from you",    icon: "🟡", dot: "bg-amber-400",  bg: "bg-amber-400/10 border-amber-400/30" },
  waiting_on_lawyer:  { label: "Waiting on your lawyer",   icon: "🔵", dot: "bg-blue-400",   bg: "bg-blue-400/10 border-blue-400/30" },
  waiting_on_court:   { label: "Waiting on court",          icon: "⚫", dot: "bg-slate-400",  bg: "bg-slate-400/10 border-slate-400/20" },
  in_progress:        { label: "In progress",               icon: "🟢", dot: "bg-brand-teal", bg: "bg-brand-teal/8 border-brand-teal/20" },
};

export const PRIORITY_BAR: Record<string, string> = {
  urgent: "bg-red-500", high: "bg-brand-gold", medium: "bg-brand-accent", low: "bg-brand-teal",
};

export const PRIORITY_TONE: Record<string, "gold" | "teal" | "blue" | "red" | "muted"> = {
  low: "teal",
  medium: "blue",
  high: "gold",
  urgent: "red",
};

export const CATEGORY_LABEL: Record<string, string> = {
  cheque_bounce: "Cheque Bounce", consumer: "Consumer", rera: "RERA / Builder",
  property: "Property", family: "Family", labour: "Labour",
  criminal: "Criminal", cyber: "Cyber", other: "Other",
};
