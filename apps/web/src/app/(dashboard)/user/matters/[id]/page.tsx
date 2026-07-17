"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  FileText,
  ChevronRight,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Spinner, Card, EmptyState, cn } from "@/shared/components/ui";
import { useCaseOverview } from "@/features/docket/hooks/useCaseOverview";
import CaseBreadcrumb from "@/features/docket/components/shared/CaseBreadcrumb";
import CaseTabs from "@/features/docket/components/shared/CaseTabs";
import { StatusHero } from "@/features/docket/components/client/StatusHero";
import { YourLawyerCard } from "@/features/docket/components/client/YourLawyerCard";
import ClientDocumentsTab from "@/features/docket/components/client/ClientDocumentsTab";
import ClientMessagesTab from "@/features/docket/components/client/ClientMessagesTab";
import ClientBillingTab from "@/features/docket/components/client/ClientBillingTab";
import ClientTimelineTab from "@/features/docket/components/client/ClientTimelineTab";
import { ClientCaseOverview } from "@/features/docket/types";

function ClientCaseFactsStrip({ facts }: { facts: Record<string, any> }) {
  const filed = facts.filed_date
    ? new Date(facts.filed_date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <Card className="rounded-xl border border-brand-gold/12 bg-base-100 shadow-sm p-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground font-sans">
            Case no.
          </span>
          <span className="block text-[11px] font-sans text-foreground mt-0.5">
            {facts.case_number || "Pending"}
          </span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground font-sans">
            Court
          </span>
          <span className="block text-[11px] font-sans text-foreground mt-0.5">
            {facts.court || "—"}
          </span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground font-sans">
            Type
          </span>
          <span className="block text-[11px] font-sans text-foreground mt-0.5">
            {facts.category || "—"}
          </span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground font-sans">
            Filed
          </span>
          <span className="block text-[11px] font-sans text-foreground mt-0.5">
            {filed}
          </span>
        </div>
      </div>
      {facts.lawyer_name && (
        <>
          <div className="border-t border-dashed border-brand-gold/12 my-3" />
          <div>
            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground font-sans">
              Your lawyer
            </span>
            <span className="block text-[11px] font-sans text-foreground mt-0.5">
              {facts.lawyer_name}
            </span>
          </div>
        </>
      )}
    </Card>
  );
}

export default function ClientCaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { data, isLoading } = useCaseOverview(id);
  const [activeTab, setActiveTab] = useState("overview");

  // Allow deep-linking to a tab via ?tab= query param
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["overview", "documents", "messages", "billing", "timeline"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

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
        title="Case not found"
        body="This case doesn't exist or you don't have access to it."
      />
    );
  }

  const overview = data as ClientCaseOverview;
  const matterId = id;
  const caseFacts = overview.case_facts || {};

  return (
    <div className="animate-fade-in-up max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <CaseBreadcrumb role="user" caseName={caseFacts.case_number || "Your case"} />

      {/* Title + case number */}
      <div>
        <h1 className="font-serif text-3xl font-bold">Your case</h1>
        {caseFacts.case_number && (
          <p className="mt-1 text-sm text-brand-blue-light/50 font-mono">
            {caseFacts.case_number}
          </p>
        )}
      </div>

      {/* Case facts strip (like lawyer dashboard) */}
      {caseFacts && <ClientCaseFactsStrip facts={caseFacts} />}

      {/* Tabs */}
      <CaseTabs
        role="user"
        activeTab={activeTab}
        onTabChange={setActiveTab}
        matterId={matterId}
      />

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Status hero */}
          <StatusHero
            stage={overview.stage || "filed"}
            statusText={
              overview.status_text ||
              "Your case is being handled by your lawyer."
            }
          />

          {/* Two-column row: next hearing + your lawyer */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Next hearing (informational, accent border) */}
            {overview.next_hearing && (
              <Card className="p-5 border-l-4 border-l-brand-accent">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-accent">
                  Next hearing
                </p>
                <p className="mt-1 font-serif text-lg font-bold">
                  {overview.next_hearing.date
                    ? new Date(
                        overview.next_hearing.date
                      ).toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "long",
                      })
                    : "Date pending"}
                </p>
                <p className="mt-1 text-sm text-brand-blue-light/55">
                  {overview.next_hearing.description ||
                    "Court hearing scheduled"}
                </p>
                <p className="mt-2 text-xs text-brand-blue-light/40 italic">
                  You don&apos;t need to attend unless your lawyer asks you to.
                </p>
              </Card>
            )}

            {/* No next hearing - info card */}
            {!overview.next_hearing && !overview.lawyer && (
              <Card className="p-5 border-l-4 border-l-brand-accent/40">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-accent/70">
                  Status
                </p>
                <p className="mt-1 font-serif text-base font-bold">
                  Awaiting lawyer assignment
                </p>
                <p className="mt-1 text-sm text-brand-blue-light/55">
                  Once a lawyer is assigned, they will schedule court hearings.
                </p>
              </Card>
            )}

            {/* Your lawyer */}
            {overview.lawyer ? (
              <YourLawyerCard
                name={overview.lawyer.name}
                avatar={overview.lawyer.avatar}
              />
            ) : (
              <Card className="p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-blue-light/50">
                  Your lawyer
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-base-300 border border-brand-gold/10">
                    <Clock className="h-5 w-5 text-brand-blue-light/40" />
                  </div>
                  <div>
                    <p className="font-serif text-base font-bold text-brand-blue-dark">
                      Being assigned
                    </p>
                    <p className="mt-0.5 text-xs text-brand-blue-light/55">
                      We&apos;re finding the right lawyer for your case
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* "You need to" action cards */}
          {overview.pending_tasks && overview.pending_tasks.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold mb-3">
                You need to
              </p>
              <div className="space-y-3">
                {overview.pending_tasks.map((task: any) => (
                  <Card
                    key={task.id}
                    className={cn(
                      "flex items-center gap-3 p-4",
                      task.is_overdue && "border-l-4 border-l-amber-400"
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gold/8">
                      <AlertCircle className="h-4 w-4 text-brand-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {task.title}
                      </p>
                      {task.due_date && (
                        <p
                          className={cn(
                            "text-[11px]",
                            task.is_overdue
                              ? "text-amber-600 font-semibold"
                              : "text-brand-blue-light/45"
                          )}
                        >
                          {task.is_overdue
                            ? "Overdue"
                            : `Due ${new Date(task.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-brand-blue-light/20" />
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Recent updates timeline */}
          {overview.recent_updates && overview.recent_updates.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold mb-3">
                Recent updates
              </p>
              <Card className="overflow-hidden">
                <div className="divide-y divide-brand-gold/6">
                  {overview.recent_updates.map((update: any) => (
                    <div
                      key={update.id}
                      className="flex items-start gap-3 px-5 py-3.5"
                    >
                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold/40" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-brand-blue-light/70 leading-relaxed">
                          {update.description}
                        </p>
                        <p className="mt-0.5 text-[11px] text-brand-blue-light/35">
                          {new Date(
                            update.occurred_at
                          ).toLocaleDateString("en-IN", {
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

          {/* Quick stats row (3 cards) */}
          {overview.stats && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="p-4 text-center">
                <p className="font-serif text-2xl font-bold">
                  {overview.stats.hearings_count}
                </p>
                <p className="mt-0.5 text-[11px] text-brand-blue-light/45">
                  Hearings so far
                </p>
              </Card>
              <Card className="p-4 text-center">
                <p className="font-serif text-2xl font-bold">
                  {overview.stats.documents_count}
                </p>
                <p className="mt-0.5 text-[11px] text-brand-blue-light/45">
                  Documents
                </p>
              </Card>
              <Card className="p-4 text-center">
                <p className="font-serif text-2xl font-bold">
                  {overview.stats.months_running}
                </p>
                <p className="mt-0.5 text-[11px] text-brand-blue-light/45">
                  Month{overview.stats.months_running !== 1 ? "s" : ""} running
                </p>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Documents tab */}
      {activeTab === "documents" && <ClientDocumentsTab matterId={matterId} />}

      {/* Timeline tab */}
      {activeTab === "timeline" && <ClientTimelineTab matterId={matterId} />}

      {/* Billing tab */}
      {activeTab === "billing" && <ClientBillingTab matterId={matterId} />}

      {/* Messages tab */}
      {activeTab === "messages" && <ClientMessagesTab matterId={matterId} />}
    </div>
  );
}