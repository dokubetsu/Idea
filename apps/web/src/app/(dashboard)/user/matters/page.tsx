"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Scale, ChevronRight, Clock } from "lucide-react";
import { useMatters } from "@/features/matters/hooks/useMatters";
import { IntakeWizard } from "@/features/intake/components/IntakeWizard";
import type { Matter } from "@/entities/types";

const STATUS_LABEL: Record<string, string> = {
  intake: "Setting up",
  assessment: "Being reviewed",
  matching: "Finding a lawyer",
  active: "Active",
  resolved: "Resolved",
  archived: "Archived",
  draft: "Draft",
};

const STATUS_DOT: Record<string, string> = {
  intake: "bg-brand-gold",
  assessment: "bg-brand-accent",
  matching: "bg-brand-accent",
  active: "bg-brand-teal",
  resolved: "bg-brand-teal/60",
  archived: "bg-base-300",
  draft: "bg-base-300",
};

const HEALTH_CONFIG: Record<string, { label: string; dot: string; bg: string }> = {
  waiting_on_client:  { label: "Waiting on you",       dot: "bg-amber-400",    bg: "bg-amber-400/10 border-amber-400/20" },
  waiting_on_lawyer:  { label: "Waiting on your lawyer", dot: "bg-brand-teal", bg: "bg-brand-teal/10 border-brand-teal/20" },
  waiting_on_court:   { label: "Waiting on court",      dot: "bg-slate-400",   bg: "bg-slate-400/10 border-slate-400/20" },
  in_progress:        { label: "In progress",           dot: "bg-brand-gold",  bg: "bg-brand-gold/8 border-brand-gold/15" },
};

const PRIORITY_BAR: Record<string, string> = {
  urgent: "bg-red-500", high: "bg-brand-gold", medium: "bg-brand-accent", low: "bg-brand-teal",
};

const CATEGORY_LABEL: Record<string, string> = {
  cheque_bounce: "Cheque Bounce", consumer: "Consumer", rera: "RERA / Builder",
  property: "Property", family: "Family", labour: "Labour",
  criminal: "Criminal", cyber: "Cyber", other: "Other",
};

type FilterTab = "all" | "active" | "waiting" | "resolved";

export default function UserCasesPage() {
  const router = useRouter();
  const { data: matters = [], isLoading } = useMatters();
  const [showWizard, setWizard] = useState(false);
  const [tab, setTab] = useState<FilterTab>("all");

  const filtered = matters.filter((m) => {
    if (tab === "all") return true;
    if (tab === "active") return ["active", "assessment", "matching", "intake"].includes(m.status);
    if (tab === "waiting") return (m as Matter & { case_health?: string }).case_health === "waiting_on_client";
    if (tab === "resolved") return ["resolved", "archived"].includes(m.status);
    return true;
  });

  const waitingCount = matters.filter(
    (m) => (m as Matter & { case_health?: string }).case_health === "waiting_on_client"
  ).length;

  return (
    <>
      <div className="animate-fade-in-up space-y-7">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">Your Cases</p>
            <h1 className="mt-1 font-serif text-4xl font-bold">My Cases</h1>
            <p className="mt-1.5 text-sm text-brand-blue-light/55">
              Each case is reviewed by AI and assigned to a qualified lawyer.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWizard(true)}
            className="shimmer-btn inline-flex items-center gap-2 rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-semibold text-brand-blue-dark hover:bg-brand-gold-light transition-all"
          >
            <Plus className="h-4 w-4" /> New case
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5">
          {(["all", "active", "waiting", "resolved"] as FilterTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative rounded-xl px-3.5 py-1.5 text-[11px] font-semibold transition-all capitalize ${
                tab === t
                  ? "bg-brand-gold text-brand-blue-dark"
                  : "border border-brand-gold/15 text-brand-blue-light/55 hover:border-brand-gold/30 hover:text-brand-blue-light/80"
              }`}
            >
              {t === "waiting" ? "Waiting on you" : t === "all" ? "All cases" : t.charAt(0).toUpperCase() + t.slice(1)}
              {t === "waiting" && waitingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-brand-blue-dark">
                  {waitingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 rounded-full border-2 border-brand-gold/25 border-t-brand-gold animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <div className="animate-float rounded-2xl border border-brand-gold/12 bg-brand-gold/5 p-5">
              <Scale className="h-8 w-8 text-brand-gold/40" />
            </div>
            <p className="mt-5 font-serif text-xl font-bold">
              {tab === "all" ? "No cases yet" : "No cases in this filter"}
            </p>
            <p className="mt-2 text-sm text-brand-blue-light/55">
              {tab === "all"
                ? "Tell us what happened and we'll assess your case for free."
                : "Try switching to 'All cases' to see everything."}
            </p>
            {tab === "all" && (
              <button
                type="button"
                onClick={() => setWizard(true)}
                className="shimmer-btn mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-semibold text-brand-blue-dark hover:bg-brand-gold-light"
              >
                <Plus className="h-4 w-4" /> Tell us about your case
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-brand-gold/8 rounded-xl border border-brand-gold/12 bg-base-100 overflow-hidden">
            {filtered.map((m) => <CaseRow key={m.id} matter={m as Matter & { case_health?: string }} />)}
          </div>
        )}
      </div>

      {showWizard && (
        <div className="fixed inset-0 z-50 flex justify-center items-start overflow-y-auto bg-black/40 p-4 backdrop-blur-sm md:py-12">
          <div className="my-auto w-full max-w-2xl">
            <IntakeWizard
              onClose={() => setWizard(false)}
              onOpenLegalNotice={() => router.push("/user/legal-notice")}
            />
          </div>
        </div>
      )}
    </>
  );
}

function CaseRow({ matter: m }: { matter: Matter & { case_health?: string } }) {
  const health = HEALTH_CONFIG[m.case_health ?? "in_progress"] ?? HEALTH_CONFIG.in_progress;
  const statusLabel = STATUS_LABEL[m.status] ?? m.status;
  const dot = STATUS_DOT[m.status] ?? "bg-base-300";
  const catLabel = CATEGORY_LABEL[m.category] ?? m.category.replace("_", " ");

  const updatedAt = new Date(m.updated_at ?? m.created_at);
  const daysAgo = Math.floor((Date.now() - updatedAt.getTime()) / 86400000);
  const timeLabel = daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo} days ago`;

  return (
    <Link
      href={`/user/matters/${m.id}`}
      className="group flex items-center gap-4 p-4 transition-all hover:bg-brand-gold/4"
    >
      {/* Priority bar */}
      <div className={`h-10 w-1 shrink-0 rounded-full ${PRIORITY_BAR[m.priority] ?? "bg-base-300"}`} />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <p className="font-serif text-base font-bold leading-snug truncate">{m.title}</p>
          <span className="shrink-0 rounded-full border border-brand-gold/20 bg-brand-gold/8 px-2 py-0.5 text-[10px] font-semibold text-brand-gold">
            {catLabel}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-brand-blue-light/50">
          <span className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
            {statusLabel}
          </span>
          {m.lawyer_name && <span>· {m.lawyer_name}</span>}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeLabel}
          </span>
        </div>
        {m.summary && (
          <p className="mt-1 text-xs text-brand-blue-light/45 line-clamp-1">{m.summary}</p>
        )}
      </div>

      {/* Health badge */}
      <div className={`hidden sm:flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${health.bg}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />
        {health.label}
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-brand-blue-light/25 group-hover:text-brand-gold transition-colors" />
    </Link>
  );
}
