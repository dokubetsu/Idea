"use client";

import Link from "next/link";
import {
  FileText,
  MessageSquare,
  Receipt,
  ChevronRight,
  Calendar,
  Clock,
  AlertCircle,
  Scale,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api/client";
import { Spinner, Card, Badge, EmptyState, cn } from "@/shared/components/ui";
import { useClientDashboard } from "@/features/docket/hooks/useClientDashboard";
import type { ClientDashboard } from "@/features/docket/types";

const STAGES = ["filed", "reply", "evidence", "arguments", "judgment"] as const;
const STAGE_LABELS: Record<string, string> = {
  filed: "Filed",
  reply: "Reply",
  evidence: "Evidence",
  arguments: "Arguments",
  judgment: "Judgment",
};

function ProgressIndicator({ currentStage }: { currentStage: string }) {
  const currentIdx = STAGES.indexOf(currentStage as typeof STAGES[number]);

  return (
    <div className="flex items-center gap-1.5">
      {STAGES.map((stage, i) => (
        <div key={stage} className="flex items-center gap-1.5">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full transition-all",
                i < currentIdx
                  ? "bg-brand-teal"
                  : i === currentIdx
                  ? "bg-brand-gold animate-gold-pulse"
                  : "bg-brand-base-300"
              )}
            />
            <span
              className={cn(
                "text-[9px] font-semibold",
                i === currentIdx
                  ? "text-brand-gold"
                  : i < currentIdx
                  ? "text-brand-teal"
                  : "text-brand-blue-light/30"
              )}
            >
              {STAGE_LABELS[stage]}
            </span>
          </div>
          {i < STAGES.length - 1 && (
            <div
              className={cn(
                "h-px w-6 sm:w-10 mb-4",
                i < currentIdx ? "bg-brand-teal" : "bg-brand-base-300"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function ClientDashboardPage() {
  const { data, isLoading } = useClientDashboard();
  const { data: me } = useQuery({
    queryKey: ["identity", "me"],
    queryFn: () => apiClient.get<{ lawyer_profile?: { is_verified: boolean } | null }>("/identity/me"),
  });

  const lawyerProfile = me?.lawyer_profile;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={FileText}
        title="No data available"
        body="We couldn't load your dashboard. Please try again."
      />
    );
  }

  return (
    <div className="animate-fade-in-up max-w-3xl mx-auto space-y-9">
      {/* Greeting */}
      <div>
        <h1 className="font-serif text-4xl font-bold">{data.greeting}.</h1>
        <p className="mt-1.5 text-sm text-brand-blue-light/55">{data.date_display}</p>
      </div>

      {/* Pending lawyer verification banner */}
      {lawyerProfile && !lawyerProfile.is_verified && (
        <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/8 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gold/15 text-brand-gold">
              <Scale className="h-4 w-4" />
            </div>
            <div>
              <p className="font-serif text-base font-bold text-brand-blue-dark">Advocate application pending verification</p>
              <p className="mt-1 text-xs leading-5 text-brand-blue-light/70">
                Your request to register as a lawyer is currently undergoing review by our administrators.
                You can browse and use the platform as a petitioner in the meantime.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Your case card (hero) */}
      {data.case ? (
        <Link href={`/user/matters/${data.case.id}`} className="block group">
          <Card className="p-6 sm:p-8 transition-all duration-200 group-hover:border-brand-gold/25 group-hover:shadow-md group-hover:-translate-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
              Your case
            </p>
            <h2 className="mt-2 font-serif text-2xl font-bold">
              {data.case.plain_title}
            </h2>
            <p className="mt-2 text-sm text-brand-blue-light/55 leading-relaxed">
              {data.case.status_text}
            </p>

            {/* Progress indicator */}
            <div className="mt-6">
              <ProgressIndicator currentStage={data.case.stage} />
            </div>

            {/* Lawyer info */}
            {data.case.lawyer_name && (
              <div className="mt-6 flex items-center gap-3 pt-5 border-t border-brand-gold/8">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gold/10 text-brand-gold font-semibold text-sm">
                  {data.case.lawyer_name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{data.case.lawyer_name}</p>
                  <p className="text-[11px] text-brand-blue-light/45">Your lawyer</p>
                </div>
                <span className="text-xs font-semibold text-brand-gold group-hover:text-brand-gold-light transition-colors">
                  View case →
                </span>
              </div>
            )}
          </Card>
        </Link>
      ) : (
        <EmptyState
          icon={FileText}
          title="No active case"
          body="You don't have any active cases yet. Start by telling us about your situation."
        />
      )}

      {/* Next hearing */}
      {data.case?.next_hearing_date && (
        <Card className="p-5 border-l-4 border-l-brand-accent">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10">
              <Calendar className="h-4.5 w-4.5 text-brand-accent" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-accent">
                Next hearing
              </p>
              <p className="mt-1 font-serif text-lg font-bold">
                {new Date(data.case.next_hearing_date).toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              {data.case.next_hearing_description && (
                <p className="mt-1 text-sm text-brand-blue-light/55">
                  {data.case.next_hearing_description}
                </p>
              )}
              <p className="mt-2 text-xs text-brand-blue-light/40 italic">
                You don&apos;t need to attend unless your lawyer asks you to.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* You need to */}
      {data.pending_tasks.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold mb-3">
            You need to
          </p>
          <div className="space-y-3">
            {data.pending_tasks.map((task) => (
              <Card
                key={task.id}
                className={cn(
                  "flex items-center gap-3 p-4 transition-all hover:border-brand-gold/25 hover:shadow-sm",
                  task.is_overdue && "border-l-4 border-l-amber-400"
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gold/8">
                  <AlertCircle className="h-4 w-4 text-brand-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{task.title}</p>
                  {task.due_date && (
                    <p
                      className={cn(
                        "text-[11px]",
                        task.is_overdue ? "text-amber-600 font-semibold" : "text-brand-blue-light/45"
                      )}
                    >
                      {task.is_overdue ? "Overdue" : `Due ${new Date(task.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-brand-blue-light/20" />
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recent updates */}
      {data.recent_updates.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold mb-3">
            Recent updates
          </p>
          <Card className="overflow-hidden">
            <div className="divide-y divide-brand-gold/6">
              {data.recent_updates.map((update) => (
                <div key={update.id} className="flex items-start gap-3 px-5 py-3.5">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold/40" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-brand-blue-light/70 leading-relaxed">
                      {update.description}
                    </p>
                    <p className="mt-0.5 text-[11px] text-brand-blue-light/35">
                      {new Date(update.occurred_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { href: data.case ? `/user/matters/${data.case.id}` : "/user/matters", icon: FileText, label: "Documents", count: data.stats.documents_count },
          { href: data.case ? `/user/matters/${data.case.id}` : "/user/matters", icon: MessageSquare, label: "Messages", count: null },
          { href: data.case ? `/user/matters/${data.case.id}` : "/user/matters", icon: Receipt, label: "Billing", count: null },
        ].map(({ href, icon: Icon, label, count }) => (
          <Link key={label} href={href}>
            <Card className="flex items-center gap-3 p-4 transition-all hover:border-brand-gold/25 hover:shadow-sm hover:-translate-y-0.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gold/8">
                <Icon className="h-4 w-4 text-brand-gold" />
              </div>
              <div>
                <p className="text-sm font-semibold">{label}</p>
                {count !== null && (
                  <p className="text-[11px] text-brand-blue-light/45">{count} files</p>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick stats */}
      {data.case && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4 text-center">
            <p className="font-serif text-2xl font-bold">{data.stats.hearings_count}</p>
            <p className="mt-0.5 text-[11px] text-brand-blue-light/45">Hearings so far</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="font-serif text-2xl font-bold">{data.stats.documents_count}</p>
            <p className="mt-0.5 text-[11px] text-brand-blue-light/45">Documents</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="font-serif text-2xl font-bold">{data.stats.months_running}</p>
            <p className="mt-0.5 text-[11px] text-brand-blue-light/45">
              Month{data.stats.months_running !== 1 ? "s" : ""} running
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
