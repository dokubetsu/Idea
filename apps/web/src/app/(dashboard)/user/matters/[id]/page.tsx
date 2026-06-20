"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Calendar, CheckCircle2, Clock, FileText, Landmark, MessageSquare, Send, Shield, User, Scale } from "lucide-react";
import Link from "next/link";
import { useMatter, useUpdates, usePostUpdate, useFacts } from "@/features/matters/hooks/useMatters";
import { FactsPanel } from "@/features/matters/components/FactsPanel";
import { LimitationBanner } from "@/features/legal-tools/components/LimitationBanner";
import { DocumentDraftCard } from "@/features/legal-tools/components/DocumentDraftCard";
import { DocumentVault } from "@/features/matters/components/DocumentVault";
import { MeetingsPanel } from "@/features/matters/components/MeetingsPanel";
import { MilestoneBillingCard } from "@/features/matters/components/MilestoneBillingCard";
import { Badge, Button, Card, Spinner } from "@/shared/components/ui";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  intake: "Setting up",
  assessment: "Being reviewed",
  matching: "Finding a lawyer",
  active: "Active",
  resolved: "Resolved",
  archived: "Archived",
};

const STATUS_TONE: Record<string, "gold" | "teal" | "blue" | "muted" | "red"> = {
  draft: "muted",
  intake: "gold",
  assessment: "blue",
  matching: "blue",
  active: "teal",
  resolved: "teal",
  archived: "muted",
};

const HEALTH_CONFIG: Record<string, { label: string; icon: string; dot: string; bg: string }> = {
  waiting_on_client:  { label: "Action needed from you",    icon: "🟡", dot: "bg-amber-400",  bg: "bg-amber-400/10 border-amber-400/30" },
  waiting_on_lawyer:  { label: "Waiting on your lawyer",   icon: "🔵", dot: "bg-blue-400",   bg: "bg-blue-400/10 border-blue-400/30" },
  waiting_on_court:   { label: "Waiting on court",          icon: "⚫", dot: "bg-slate-400",  bg: "bg-slate-400/10 border-slate-400/20" },
  in_progress:        { label: "In progress",               icon: "🟢", dot: "bg-brand-teal", bg: "bg-brand-teal/8 border-brand-teal/20" },
};

const PRIORITY_TONE: Record<string, "gold" | "teal" | "blue" | "red" | "muted"> = {
  low: "teal",
  medium: "blue",
  high: "gold",
  urgent: "red",
};

export default function UserMatterDetailPage() {
  const { id } = useParams() as { id: string };
  
  // Fetch details
  const { data: matter, isLoading, error, refetch: refetchDetails } = useMatter(id);
  const { data: facts = [] } = useFacts(id);
  const { data: updates = [], isLoading: updatesLoading, refetch: refetchUpdates } = useUpdates(id);
  
  // Reply states
  const postUpdate = usePostUpdate(id);
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  async function submitReply(parentId: string) {
    if (!replyText.trim() || replyText.trim().length < 5) return;
    await postUpdate.mutateAsync({ content: replyText.trim(), is_internal: false, parent_id: parentId });
    setReplyText("");
    setReplyTarget(null);
    refetchUpdates();
  }

  if (isLoading) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-3">
        <Spinner className="h-10 w-10" />
        <p className="text-sm text-brand-blue-light/50">Loading your case details...</p>
      </div>
    );
  }

  if (error || !matter) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-2xl border border-red-500/20 bg-red-50 p-5 text-red-500">
          <Scale className="h-8 w-8" />
        </div>
        <h2 className="font-serif text-2xl font-bold">Case not found</h2>
        <p className="text-sm text-brand-blue-light/65 max-w-sm">
          This case doesn&apos;t exist or you don&apos;t have permission to view it.
        </p>
        <Link href="/user/matters">
          <Button variant="secondary" size="sm">Back to my cases</Button>
        </Link>
      </div>
    );
  }

  // Filter scheduled hearings (court hearings — not in-platform meetings)
  const scheduledHearings = matter.hearings?.filter(h => h.status === "scheduled") || [];
  const health = HEALTH_CONFIG[(matter as typeof matter & { case_health?: string }).case_health ?? "in_progress"] ?? HEALTH_CONFIG.in_progress;
  const statusLabel = STATUS_LABEL[matter.status] ?? matter.status.replace("_", " ");

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Navigation */}
      <Link
        href="/user/matters"
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-gold hover:text-brand-gold-light transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to my cases
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between border-b border-brand-gold/12 pb-6">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
            {matter.category.replace("_", " ")}
          </p>
          <h1 className="font-serif text-3xl font-bold md:text-4xl">{matter.title}</h1>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge tone={STATUS_TONE[matter.status] ?? "muted"}>{statusLabel}</Badge>
            {/* Case Health badge */}
            <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${health.bg}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />
              {health.label}
            </div>
          </div>
        </div>
      </div>

      {/* Case Progress Stepper */}
      {matter.milestones && matter.milestones.length > 0 && (
        <Card className="p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold mb-5">
            Case Progress Milestones
          </p>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-2">
            {matter.milestones.map((m, idx) => (
              <div key={m.id} className="flex-1 flex flex-col md:flex-row items-center gap-2 relative">
                {/* Horizontal line connector */}
                {idx < matter.milestones.length - 1 && (
                  <div className="hidden md:block absolute left-[calc(50%+16px)] right-[-50%] top-4 h-0.5 bg-brand-gold/15" />
                )}
                
                {/* Step Circle */}
                <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
                  m.status === "completed" ? "bg-brand-teal border-brand-teal text-white font-bold" :
                  m.status === "current" ? "bg-brand-gold/20 border-brand-gold text-brand-gold font-bold scale-110" :
                  "bg-base-100 border-brand-gold/15 text-brand-blue-light/30"
                }`}>
                  {m.status === "completed" ? "✓" : m.order_index}
                </div>

                <div className="text-center md:text-left min-w-[120px] max-w-[160px]">
                  <p className={`text-[11px] font-bold ${
                    m.status === "completed" ? "text-brand-blue-dark/60" :
                    m.status === "current" ? "text-brand-blue-dark font-extrabold" :
                    "text-brand-blue-light/40"
                  }`}>{m.title}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <LimitationBanner category={matter.category} facts={facts} />

      {/* Main Content Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Details, Documents & Timeline (2/3 width) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Summary */}
          <Card className="p-6 space-y-4">
            <h3 className="font-serif text-xl font-bold">Case Overview & Rationale</h3>
            <div className="h-px bg-brand-gold/12" />
            <p className="text-sm leading-relaxed text-brand-blue-dark/80 whitespace-pre-line">
              {matter.summary || "No summary details have been provided for this matter."}
            </p>
          </Card>

          <DocumentVault matterId={matter.id} />
          <MeetingsPanel matterId={matter.id} />
          <MilestoneBillingCard matterId={matter.id} isLawyer={false} />

          {/* Document Templates Card */}
          <DocumentDraftCard matterId={matter.id} category={matter.category} />

          {/* Trust Timeline (replaces raw activity) */}
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="font-serif text-xl font-bold">Case Timeline</h3>
              <p className="text-xs text-brand-blue-light/50 mt-1">Everything that has happened on your case, in order.</p>
            </div>
            <div className="h-px bg-brand-gold/12" />

            {updatesLoading ? (
              <div className="flex justify-center py-6"><Spinner className="h-6 w-6" /></div>
            ) : updates.length === 0 ? (
              <p className="py-6 text-center text-sm text-brand-blue-light/40">No activity yet on this case.</p>
            ) : (
              <div className="space-y-0 relative">
                {/* Vertical line */}
                <div className="absolute left-3.5 top-4 bottom-4 w-[2px] bg-brand-gold/8" />
                {updates.map((u, idx) => {
                  const isUser = u.author_name && u.author_name !== "System";
                  const timeAgo = (() => {
                    const d = Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86400000);
                    if (d === 0) return new Date(u.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                    if (d === 1) return "Yesterday";
                    return new Date(u.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                  })();
                  return (
                    <div key={u.id} className="flex gap-4 py-3 relative">
                      {/* Timeline dot */}
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 z-10 border ${
                        isUser
                          ? "bg-brand-gold/10 border-brand-gold/30"
                          : "bg-brand-blue-dark/50 border-white/10"
                      }`}>
                        {isUser
                          ? <User className="h-3 w-3 text-brand-gold" />
                          : <CheckCircle2 className="h-3 w-3 text-brand-blue-light/40" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-xs font-bold text-brand-blue-dark">
                            {u.author_name || "LeAd"}
                          </p>
                          <p className="text-[10px] text-brand-blue-light/40 shrink-0">{timeAgo}</p>
                        </div>
                        <p className="text-sm leading-relaxed text-brand-blue-dark/80 whitespace-pre-line">
                          {u.content}
                        </p>
                        {/* Reply */}
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setReplyTarget(replyTarget === u.id ? null : u.id);
                              setReplyText("");
                            }}
                            className="text-[10px] font-semibold uppercase tracking-wider text-brand-gold hover:text-brand-gold-light flex items-center gap-1.5"
                          >
                            <MessageSquare className="h-3 w-3" /> {replyTarget === u.id ? "Cancel" : "Reply"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Reply box — floated below timeline */}
            {replyTarget && (
              <div className="flex gap-2 pt-2 border-t border-brand-gold/8">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your message... (min 5 characters)"
                  minLength={5}
                  className="flex-1 rounded-lg border border-brand-gold/15 bg-base-100 px-3 py-1.5 text-xs outline-none focus:border-brand-gold"
                />
                <Button size="sm" onClick={() => submitReply(replyTarget)} disabled={replyText.trim().length < 5 || postUpdate.isPending}>
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            )}
          </Card>


        </div>

        {/* Right Column: Metadata, Hearings & Facts (1/3 width) */}
        <div className="space-y-6">
          {/* Upcoming Court Hearings */}
          {scheduledHearings.length > 0 && (
            <Card className="p-6 space-y-4 border-brand-gold/25 bg-brand-gold/5 shadow-md">
              <h3 className="font-serif text-lg font-bold flex items-center gap-2 text-brand-blue-dark">
                <Clock className="h-5 w-5 text-brand-gold animate-float" /> Upcoming Court Date
              </h3>
              <div className="h-px bg-brand-gold/12" />

              <div className="space-y-4">
                {scheduledHearings.map(h => (
                  <div key={h.id} className="space-y-2">
                    <p className="text-sm font-bold text-brand-blue-dark">
                      {new Date(h.hearing_date).toLocaleDateString("en-IN", {
                        weekday: "short",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                    <div className="space-y-1.5 text-xs text-brand-blue-light/65">
                      {h.courtroom && <p>Courtroom: <span className="font-semibold text-brand-blue-dark">{h.courtroom}</span></p>}
                      {h.judge && <p>Judge: <span className="font-semibold text-brand-blue-dark">{h.judge}</span></p>}
                      {h.purpose && <p>Purpose: <span className="font-semibold text-brand-blue-dark">{h.purpose}</span></p>}
                    </div>
                    {h.notes && (
                      <p className="text-[11px] bg-white/70 p-2 border border-brand-gold/10 rounded-lg whitespace-pre-line text-brand-blue-dark/80">
                        {h.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Metadata Card */}
          <Card className="p-6 space-y-4">
            <h3 className="font-serif text-lg font-bold">Case Details</h3>
            <div className="h-px bg-brand-gold/12" />

            <div className="space-y-3.5">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 shrink-0 text-brand-gold" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-blue-light/45">Created Date</p>
                  <p className="text-xs font-bold text-brand-blue-dark">
                    {new Date(matter.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {matter.lawyer_name ? (
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 shrink-0 text-brand-gold" />
                  <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-blue-light/45">Your Lawyer</p>
                    <p className="text-xs font-bold text-brand-blue-dark">{matter.lawyer_name}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 shrink-0 text-brand-gold/40 animate-pulse" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-blue-light/45">Your Lawyer</p>
                    <p className="text-xs font-medium text-brand-gold">Finding the right lawyer for you...</p>
                  </div>
                </div>
              )}

              {matter.court_name && (
                <div className="flex items-center gap-3">
                  <Landmark className="h-4 w-4 shrink-0 text-brand-gold" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-blue-light/45">Court Name</p>
                    <p className="text-xs font-bold text-brand-blue-dark">{matter.court_name}</p>
                  </div>
                </div>
              )}

              {matter.case_number && (
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-brand-gold" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-blue-light/45">Case Number</p>
                    <p className="text-xs font-bold text-brand-blue-dark">{matter.case_number}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Facts Panel */}
          <Card className="p-6">
            <FactsPanel matterId={matter.id} canVerify={false} />
          </Card>
        </div>
      </div>
    </div>
  );
}
