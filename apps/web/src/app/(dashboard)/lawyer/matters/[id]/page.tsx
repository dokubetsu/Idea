"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { FileText } from "lucide-react";
import { Spinner, Card, EmptyState } from "@/shared/components/ui";
import { useToast } from "@/shared/components/ui/Toast";
import { useCaseOverview, useNudgeClient } from "@/features/docket/hooks/useCaseOverview";
import CaseBreadcrumb from "@/features/docket/components/shared/CaseBreadcrumb";
import CaseTabs from "@/features/docket/components/shared/CaseTabs";
import ContactBar from "@/features/docket/components/shared/ContactBar";
import { StubTab } from "@/features/docket/components/shared/StubTab";
import CaseFactsStrip from "@/features/docket/components/lawyer/CaseFactsStrip";
import DeadlineAlert from "@/features/docket/components/lawyer/DeadlineAlert";
import NextHearingCard from "@/features/docket/components/lawyer/NextHearingCard";
import QuickLogCard from "@/features/docket/components/lawyer/QuickLogCard";
import MyTasksCard from "@/features/docket/components/lawyer/MyTasksCard";
import InternalNotesCard from "@/features/docket/components/lawyer/InternalNotesCard";
import AiChatPanel from "@/features/docket/components/lawyer/AiChatPanel";
import DocumentsTab from "@/features/docket/components/lawyer/DocumentsTab";
import HearingsTab from "@/features/docket/components/lawyer/HearingsTab";
import CommunicationsTab from "@/features/docket/components/lawyer/CommunicationsTab";
import BillingTab from "@/features/docket/components/lawyer/BillingTab";

export default function LawyerCaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useCaseOverview(id);
  const [activeTab, setActiveTab] = useState("overview");
  const nudge = useNudgeClient(id);
  const toast = useToast();

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

  const overview = data as Record<string, any>;
  const caseFacts = overview.case_facts || {};
  const matterId = id;

  return (
    <div className="animate-fade-in-up max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <CaseBreadcrumb role="lawyer" caseName={caseFacts.case_number || "Case"} />

      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold">
            {caseFacts.case_number || "Matter"}
          </h1>
          {caseFacts.plaintiff?.name && (
            <p className="mt-1 text-sm text-brand-blue-light/55">
              {caseFacts.plaintiff.name}
            </p>
          )}
        </div>
        <ContactBar
          clientName={caseFacts.plaintiff?.name || "Client"}
          clientPhone={caseFacts.plaintiff?.contact?.phone || null}
        />
      </div>

      {/* Tabs */}
      <CaseTabs
        role="lawyer"
        activeTab={activeTab}
        onTabChange={setActiveTab}
        matterId={matterId}
      />

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          {/* Case facts strip */}
          <CaseFactsStrip facts={caseFacts} />

          {/* Deadline alert */}
          <DeadlineAlert message={overview.deadline_alert} />

          {/* Two-column workbench layout: left 58%, right 42% */}
          <div className="grid gap-5 lg:grid-cols-[1fr_0.72fr]">
            {/* Left column */}
            <div className="space-y-5">
              <NextHearingCard hearing={overview.next_hearing} matterId={matterId} />

              {/* From the client card */}
              {((overview.client_uploads && overview.client_uploads.length > 0) ||
                (overview.client_pending_tasks &&
                  overview.client_pending_tasks.length > 0)) && (
                <Card className="p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold mb-3">
                    From the client
                  </p>

                  {/* Uploads to review */}
                  {overview.client_uploads &&
                    overview.client_uploads.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-brand-blue-dark mb-2">
                          New uploads &mdash; {overview.client_uploads.length} to
                          review
                        </p>
                        <div className="space-y-2">
                          {overview.client_uploads
                            .slice(0, 3)
                            .map((doc: any) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between py-1.5"
                              >
                                <span className="text-sm text-brand-blue-light/70 truncate max-w-[200px]">
                                  {doc.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    toast.success(`Opened ${doc.name} for review`);
                                  }}
                                  className="text-[11px] font-semibold text-brand-gold hover:text-brand-gold-light transition-colors"
                                  aria-label={`Review ${doc.name}`}
                                >
                                  Review
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                  {/* Waiting on client */}
                  {overview.client_pending_tasks &&
                    overview.client_pending_tasks.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-brand-blue-dark mb-2">
                          Waiting on client
                        </p>
                        <div className="space-y-2">
                          {overview.client_pending_tasks.map((task: any) => (
                            <div
                              key={task.id}
                              className="flex items-center justify-between py-1.5"
                            >
                              <span className="text-sm text-brand-blue-light/70 truncate max-w-[200px]">
                                {task.title}
                              </span>
                              <button
                                type="button"
                                onClick={() => nudge.mutate(task.id)}
                                disabled={nudge.isPending}
                                className="text-[11px] font-semibold text-brand-accent hover:text-brand-accent/80 transition-colors disabled:opacity-50"
                                aria-label={`Nudge client about ${task.title}`}
                              >
                                {nudge.isPending ? "Sending…" : "Nudge"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </Card>
              )}

              {/* Recent activity timeline */}
              {overview.recent_activity &&
                overview.recent_activity.length > 0 && (
                  <Card className="p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold mb-3">
                      Recent activity
                    </p>
                    <div className="space-y-3">
                      {overview.recent_activity
                        .slice(0, 5)
                        .map((item: any) => (
                          <div
                            key={item.id}
                            className="flex items-start gap-2.5"
                          >
                            <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold/40" />
                            <div>
                              <p className="text-sm text-brand-blue-light/70">
                                {item.description}
                              </p>
                              <p className="text-[11px] text-brand-blue-light/35">
                                {new Date(
                                  item.occurred_at
                                ).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </Card>
                )}
            </div>

            {/* Right column */}
            <div className="space-y-5">
              <AiChatPanel matterId={matterId} />
              <QuickLogCard matterId={matterId} />
              <MyTasksCard matterId={matterId} tasks={overview.my_tasks || []} />
              <InternalNotesCard notes={overview.internal_notes || []} />
            </div>
          </div>
        </div>
      )}

      {activeTab === "billing" && <BillingTab matterId={matterId} />}
      {activeTab === "hearings" && <HearingsTab matterId={matterId} />}
      {activeTab === "documents" && <DocumentsTab matterId={matterId} />}
      {activeTab === "communications" && <CommunicationsTab matterId={matterId} />}
      {activeTab === "timeline" && <StubTab tabName="Timeline" />}
    </div>
  );
}