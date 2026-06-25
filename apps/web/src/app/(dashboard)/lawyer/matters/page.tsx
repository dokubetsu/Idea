"use client";

import { useState } from "react";
import { Send, Plus, Scale } from "lucide-react";
import { 
  useMatters, useMatter, useUpdates, usePostUpdate, 
} from "@/features/matters/hooks/useMatters";
import { FactsPanel } from "@/features/matters/components/FactsPanel";
import { LimitationBanner } from "@/features/legal-tools/components/LimitationBanner";
import { DocumentDraftCard } from "@/features/legal-tools/components/DocumentDraftCard";
import { DocumentVault } from "@/features/matters/components/DocumentVault";
import { MeetingsPanel } from "@/features/matters/components/MeetingsPanel";
import { Button, Badge, Spinner } from "@/shared/components/ui";
import type { Matter } from "@/entities/types";
import { useFeatures } from "@/shared/hooks/useFeatures";

// Decomposed Sub-components
import { LawyerMattersList } from "@/features/matters/components/lawyer/LawyerMattersList";
import { LawyerMatterDetailHeader } from "@/features/matters/components/lawyer/LawyerMatterDetailHeader";
import { MilestonesTabContent } from "@/features/matters/components/lawyer/MilestonesTabContent";
import { HearingsTabContent } from "@/features/matters/components/lawyer/HearingsTabContent";
import { InviteClientModal } from "@/features/matters/components/lawyer/InviteClientModal";

export default function LawyerMattersPage() {
  const { features } = useFeatures();
  const { data: matters = [], isLoading, refetch } = useMatters();
  const [selected, setSelected] = useState<Matter | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "milestones" | "hearings" | "discussion">("overview");

  // Fetch full details of selected matter
  const { data: fullMatter, refetch: refetchDetails } = useMatter(selected?.id ?? "");
  const details = fullMatter || selected;

  // Discussion Mutations
  const { data: updates = [], refetch: refetchUpdates } = useUpdates(selected?.id ?? "");
  const postUpdate = usePostUpdate(selected?.id ?? "");

  // Local Form States for Discussion Tab
  const [note, setNote] = useState("");
  const [internal, setInternal] = useState(false);
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  async function submitNote() {
    if (!selected || !note.trim()) return;
    await postUpdate.mutateAsync({ content: note, is_internal: internal });
    setNote("");
    refetchUpdates();
  }

  async function submitReply(parentId: string) {
    if (!selected || !replyText.trim()) return;
    await postUpdate.mutateAsync({ content: replyText, is_internal: false, parent_id: parentId });
    setReplyText("");
    setReplyTarget(null);
    refetchUpdates();
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">Matters Overview</p>
          <h1 className="mt-1 font-serif text-4xl font-bold">Matter Management</h1>
        </div>
        <Button onClick={() => setShowInviteModal(true)} variant="primary" size="md">
          <Plus className="h-4 w-4" /> Invite Client & Matter
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr] lg:items-start">
        {/* Left Side: Matters List */}
        <LawyerMattersList
          matters={matters}
          selectedId={selected?.id}
          onSelect={(m) => {
            setSelected(m);
            setActiveTab("overview");
          }}
          isLoading={isLoading}
        />

        {/* Right Side: Tabbed Detail Dashboard */}
        {details ? (
          <div className="rounded-xl border border-brand-gold/12 bg-base-100 overflow-hidden shadow-sm">
            {/* Header banner */}
            <LawyerMatterDetailHeader matter={details} />

            {/* Dashboard Tabs Navigation */}
            <div className="flex border-b border-brand-gold/8 bg-base-200/30 px-5 overflow-x-auto">
              {(["overview", "milestones", "hearings", "discussion"] as const)
                .filter(tab => {
                  if (tab === "milestones" && !features.milestones) return false;
                  if (tab === "hearings" && !features.hearings) return false;
                  return true;
                })
                .map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`border-b-2 px-4 py-3.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                      activeTab === tab
                        ? "border-brand-gold text-brand-blue-dark"
                        : "border-transparent text-brand-blue-light/50 hover:text-brand-blue-dark"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
            </div>

            {/* Tab Panels */}
            <div className="p-6 space-y-6">
              {/* Tab 1: Overview */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  <LimitationBanner category={details.category} facts={details.facts ?? []} />
                  <DocumentDraftCard matterId={details.id} category={details.category} />
                  <DocumentVault matterId={details.id} />
                  <MeetingsPanel matterId={details.id} isLawyer={true} />
                  <FactsPanel matterId={details.id} canVerify={true} />
                </div>
              )}

              {/* Tab 2: Case Progress Milestones */}
              {activeTab === "milestones" && (
                <MilestonesTabContent
                  matter={details}
                  refetchDetails={refetchDetails}
                />
              )}

              {/* Tab 3: Hearings Schedule */}
              {activeTab === "hearings" && (
                <HearingsTabContent
                  matter={details}
                  refetchDetails={refetchDetails}
                />
              )}

              {/* Tab 4: Discussion & Timeline */}
              {activeTab === "discussion" && (
                <div className="space-y-6">
                  {/* Post top-level update */}
                  <div className="space-y-3 border-b border-brand-gold/8 pb-5">
                    <textarea 
                      value={note} 
                      onChange={(e) => setNote(e.target.value)} 
                      rows={3}
                      placeholder="Post a case update or internal note…"
                      className="w-full rounded-xl border border-brand-gold/15 bg-base-100 px-3.5 py-3 text-[13px] outline-none resize-none transition-all focus:border-brand-gold focus:bg-white" 
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-medium text-brand-blue-light/55 cursor-pointer">
                        <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="rounded" />
                        Internal note (client won't see this)
                      </label>
                      <button 
                        type="button" 
                        onClick={submitNote} 
                        disabled={!note.trim() || postUpdate.isPending}
                        className="shimmer-btn inline-flex items-center gap-2 rounded-xl bg-brand-blue-dark px-4 py-2 text-[11px] font-semibold text-brand-gold hover:bg-brand-blue-light transition-all disabled:opacity-50"
                      >
                        {postUpdate.isPending ? <Spinner className="h-3 w-3" /> : <Send className="h-3.5 w-3.5" />} Post Update
                      </button>
                    </div>
                  </div>

                  {/* Threaded updates list */}
                  <div className="space-y-5">
                    {updates.map((u) => (
                      <div key={u.id} className="space-y-3">
                        {/* Parent Update card */}
                        <div className={`rounded-xl border p-4 ${u.is_internal ? "border-brand-gold/20 bg-brand-gold/5" : "border-brand-gold/10 bg-base-100"}`}>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div>
                              <span className="text-xs font-bold text-brand-blue-dark">{u.author_name ?? "You"}</span>
                              {u.is_internal && <span className="ml-2 rounded-full border border-brand-gold/20 bg-brand-gold/10 px-2 py-0.5 text-[8px] font-semibold text-brand-gold">INTERNAL</span>}
                            </div>
                            <span className="text-[10px] text-brand-blue-light/40">
                              {new Date(u.created_at).toLocaleDateString("en-IN", {
                                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                              })}
                            </span>
                          </div>
                          <p className="text-sm leading-6 whitespace-pre-line text-brand-blue-dark/80">{u.content}</p>
                          
                          {/* Reply Trigger */}
                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                  setReplyTarget(replyTarget === u.id ? null : u.id);
                                  setReplyText("");
                                }}
                              className="text-[10px] font-semibold uppercase tracking-wider text-brand-gold hover:text-brand-gold-light"
                            >
                              {replyTarget === u.id ? "Cancel" : "Reply"}
                            </button>
                          </div>
                        </div>

                        {/* Nested Replies */}
                        {u.replies && u.replies.length > 0 && (
                          <div className="pl-6 border-l border-brand-gold/10 space-y-2.5">
                            {u.replies.map((reply) => (
                              <div key={reply.id} className="rounded-xl border border-brand-gold/8 bg-base-200/30 p-3">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-[11px] font-bold text-brand-blue-dark">{reply.author_name}</span>
                                  <span className="text-[9px] text-brand-blue-light/40">
                                    {new Date(reply.created_at).toLocaleDateString("en-IN", {
                                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                                    })}
                                  </span>
                                </div>
                                <p className="text-xs leading-5 text-brand-blue-dark/75 whitespace-pre-line">{reply.content}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reply Input Box */}
                        {replyTarget === u.id && (
                          <div className="pl-6 flex gap-2">
                            <input
                              type="text"
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Write a reply to this thread…"
                              className="flex-1 rounded-lg border border-brand-gold/15 bg-base-100 px-3 py-1.5 text-xs outline-none focus:border-brand-gold"
                            />
                            <Button size="sm" onClick={() => submitReply(u.id)} disabled={!replyText.trim()}>
                              Send
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-brand-gold/12 bg-base-100 py-20">
            <p className="text-sm text-brand-blue-light/40">Select a matter from the sidebar to manage case details</p>
          </div>
        )}
      </div>

      {/* Invite Client & Matter Modal */}
      <InviteClientModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSuccess={() => {
          setShowInviteModal(false);
          refetch();
        }}
      />
    </div>
  );
}
