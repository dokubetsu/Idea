"use client";

import { useState } from "react";
import { 
  Send, Plus, Calendar, TrendingUp, CheckCircle, 
  Clock, User, Mail, FileText, X, ChevronRight, Scale, Briefcase 
} from "lucide-react";
import { 
  useMatters, useMatter, useUpdates, usePostUpdate, useFacts, 
  useCreateMatter, useCreateHearing, useUpdateHearing, 
  useCreateMilestone, useUpdateMilestone 
} from "@/features/matters/hooks/useMatters";
import { FactsPanel } from "@/features/matters/components/FactsPanel";
import { LimitationBanner } from "@/features/legal-tools/components/LimitationBanner";
import { DocumentDraftCard } from "@/features/legal-tools/components/DocumentDraftCard";
import { DocumentVault } from "@/features/matters/components/DocumentVault";
import { MeetingsPanel } from "@/features/matters/components/MeetingsPanel";
import { Button, Input, Textarea, Select, Badge, Card, Spinner } from "@/shared/components/ui";
import type { Matter, MatterUpdate, Hearing, Milestone, MatterCategory, MatterPriority } from "@/entities/types";

const STATUS_DOT: Record<string, string> = {
  active: "bg-brand-teal", 
  matching: "bg-brand-accent",
  assessment: "bg-brand-accent", 
  intake: "bg-brand-gold", 
  resolved: "bg-base-300",
};

export default function LawyerMattersPage() {
  const { data: matters = [], isLoading, refetch } = useMatters();
  const [selected, setSelected] = useState<Matter | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "milestones" | "hearings" | "discussion">("overview");

  // Create Matter state
  const createMatter = useCreateMatter();
  const [newMatter, setNewMatter] = useState({
    title: "",
    client_email: "",
    client_phone: "",
    category: "cheque_bounce",
    priority: "medium" as MatterPriority,
    court_name: "",
    case_number: "",
    summary: ""
  });

  async function handleCreateMatter(e: React.FormEvent) {
    e.preventDefault();
    if (!newMatter.title || !newMatter.client_email) return;
    await createMatter.mutateAsync({
      title: newMatter.title,
      client_email: newMatter.client_email,
      client_phone: newMatter.client_phone || undefined,
      category: newMatter.category,
      priority: newMatter.priority,
      court_name: newMatter.court_name || undefined,
      case_number: newMatter.case_number || undefined,
      summary: newMatter.summary
    });
    setNewMatter({
      title: "",
      client_email: "",
      client_phone: "",
      category: "cheque_bounce",
      priority: "medium",
      court_name: "",
      case_number: "",
      summary: ""
    });
    setShowInviteModal(false);
    refetch();
  }

  // Fetch full details of selected matter
  const { data: fullMatter, refetch: refetchDetails } = useMatter(selected?.id ?? "");
  const details = fullMatter || selected;

  // Additional mutations
  const { data: updates = [], refetch: refetchUpdates } = useUpdates(selected?.id ?? "");
  const postUpdate = usePostUpdate(selected?.id ?? "");
  const createHearing = useCreateHearing(selected?.id ?? "");
  const updateHearing = useUpdateHearing(selected?.id ?? "");
  const createMilestone = useCreateMilestone(selected?.id ?? "");
  const updateMilestone = useUpdateMilestone(selected?.id ?? "");

  // Local Form States
  const [note, setNote] = useState("");
  const [internal, setInternal] = useState(false);
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const [hearingDate, setHearingDate] = useState("");
  const [courtroom, setCourtroom] = useState("");
  const [judge, setJudge] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");

  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDesc, setMilestoneDesc] = useState("");
  const [milestoneAmount, setMilestoneAmount] = useState("");

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

  async function handleAddHearing(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !hearingDate) return;
    await createHearing.mutateAsync({
      hearing_date: new Date(hearingDate).toISOString(),
      courtroom: courtroom || undefined,
      judge: judge || undefined,
      purpose: purpose || undefined,
      notes: notes || undefined,
      status: "scheduled"
    });
    setHearingDate("");
    setCourtroom("");
    setJudge("");
    setPurpose("");
    setNotes("");
    refetchDetails();
  }

  async function handleAddMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !milestoneTitle) return;
    const nextIndex = (details?.milestones?.length ?? 0) + 1;
    await createMilestone.mutateAsync({
      title: milestoneTitle,
      description: milestoneDesc || undefined,
      order_index: nextIndex,
      status: "pending",
      amount_inr: milestoneAmount ? parseInt(milestoneAmount) : undefined
    });
    setMilestoneTitle("");
    setMilestoneDesc("");
    setMilestoneAmount("");
    refetchDetails();
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
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-10"><Spinner className="h-8 w-8" /></div>
          ) : matters.length === 0 ? (
            <Card className="p-6 text-center">
              <Scale className="mx-auto h-8 w-8 text-brand-blue-light/30 mb-2" />
              <p className="text-sm text-brand-blue-light/50">No matters registered yet.</p>
            </Card>
          ) : (
            matters.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelected(m);
                  setActiveTab("overview");
                }}
                className={`w-full rounded-xl border p-4 text-left transition-all ${
                  selected?.id === m.id
                    ? "border-brand-gold/40 bg-brand-gold/5 shadow-sm"
                    : "border-brand-gold/12 bg-base-100 hover:border-brand-gold/25"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`h-2 w-2 rounded-full ${STATUS_DOT[m.status] ?? "bg-base-300"}`} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-blue-light/45">
                    {m.status.replace("_", " ")}
                  </span>
                </div>
                <p className="font-serif text-base font-bold line-clamp-1">{m.title}</p>
                <p className="mt-1 text-xs text-brand-blue-light/50 truncate">
                  {m.client_email ? `Invite: ${m.client_email}` : m.user_name ? `Client: ${m.user_name}` : "Pending Invite"}
                </p>
              </button>
            ))
          )}
        </div>

        {/* Right Side: Tabbed Detail Dashboard */}
        {selected ? (
          <div className="rounded-xl border border-brand-gold/12 bg-base-100 overflow-hidden shadow-sm">
            {/* Header banner */}
            <div className="border-b border-brand-gold/12 bg-gradient-to-r from-base-200/60 to-base-100 p-5">
              <div className="flex items-center gap-3">
                <Badge tone={selected.status === "active" ? "teal" : "gold"}>{selected.status}</Badge>
                <Badge tone="blue">{selected.priority} priority</Badge>
              </div>
              <h2 className="mt-2 font-serif text-2xl font-bold">{selected.title}</h2>
              <p className="mt-1 text-sm text-brand-blue-light/65 leading-relaxed">{selected.summary}</p>
            </div>

            {/* Dashboard Tabs Navigation */}
            <div className="flex border-b border-brand-gold/8 bg-base-200/30 px-5 overflow-x-auto">
              {(["overview", "milestones", "hearings", "discussion"] as const).map((tab) => (
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
                  <LimitationBanner category={selected.category} facts={selected.facts ?? []} />
                  <DocumentDraftCard matterId={selected.id} category={selected.category} />
                  <DocumentVault matterId={selected.id} />
                  <MeetingsPanel matterId={selected.id} isLawyer={true} />
                  <FactsPanel matterId={selected.id} canVerify={true} />
                </div>
              )}

              {/* Tab 2: Case Progress Milestones */}
              {activeTab === "milestones" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-brand-gold/8 pb-3">
                    <h3 className="font-serif text-xl font-bold flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-brand-gold" /> Case Milestone Tracker
                    </h3>
                  </div>

                  {/* Add milestone form */}
                  <form onSubmit={handleAddMilestone} className="grid gap-4 md:grid-cols-3 bg-base-200/30 p-4 rounded-xl border border-brand-gold/10">
                    <div className="md:col-span-2">
                      <Input
                        label="Milestone Title"
                        placeholder="e.g. Demand Notice Replied"
                        value={milestoneTitle}
                        onChange={(e) => setMilestoneTitle(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Input
                        type="number"
                        label="Billable Amount (₹)"
                        placeholder="Optional"
                        value={milestoneAmount}
                        onChange={(e) => setMilestoneAmount(e.target.value)}
                        min={0}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button type="submit" variant="secondary" className="w-full">
                        <Plus className="h-3.5 w-3.5" /> Add Milestone
                      </Button>
                    </div>
                  </form>

                  {/* Milestones list */}
                  <div className="relative border-l border-brand-gold/20 ml-4 pl-6 space-y-6">
                    {details?.milestones?.map((m) => (
                      <div key={m.id} className="relative group">
                        {/* Dot indicator */}
                        <div className={`absolute -left-[31px] top-0 h-4 w-4 rounded-full border-2 bg-white flex items-center justify-center transition-colors ${
                          m.status === "completed" ? "border-brand-teal bg-brand-teal" : 
                          m.status === "current" ? "border-brand-gold bg-brand-gold/20 scale-110" : "border-brand-gold/30"
                        }`}>
                          {m.status === "completed" && <span className="text-[8px] text-white">✓</span>}
                          {m.status === "current" && <span className="h-1.5 w-1.5 rounded-full bg-brand-gold animate-ping" />}
                        </div>

                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className={`text-sm font-bold ${m.status === "completed" ? "text-brand-blue-dark/50 line-through" : "text-brand-blue-dark"}`}>
                              {m.title}
                            </p>
                            {m.description && <p className="text-xs text-brand-blue-light/50 mt-0.5">{m.description}</p>}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {m.status !== "completed" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-brand-teal border-brand-teal/20"
                                onClick={() => updateMilestone.mutate({
                                  milestoneId: m.id,
                                  status: "completed",
                                  completed_at: new Date().toISOString()
                                })}
                              >
                                Mark Complete
                              </Button>
                            ) : (
                              <Badge tone="teal">Completed</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: Hearings Schedule */}
              {activeTab === "hearings" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-brand-gold/8 pb-3">
                    <h3 className="font-serif text-xl font-bold flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-brand-gold" /> Hearings Schedule
                    </h3>
                  </div>

                  {/* Add hearing form */}
                  <form onSubmit={handleAddHearing} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 bg-base-200/30 p-4 rounded-xl border border-brand-gold/10">
                    <Input
                      type="datetime-local"
                      label="Hearing Date & Time"
                      value={hearingDate}
                      onChange={(e) => setHearingDate(e.target.value)}
                      required
                    />
                    <Input
                      label="Courtroom Number"
                      placeholder="e.g. Courtroom No. 4"
                      value={courtroom}
                      onChange={(e) => setCourtroom(e.target.value)}
                    />
                    <Input
                      label="Judge"
                      placeholder="e.g. Justice Indu Malhotra"
                      value={judge}
                      onChange={(e) => setJudge(e.target.value)}
                    />
                    <Input
                      label="Purpose"
                      placeholder="e.g. Framing of Charges"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                    />
                    <div className="md:col-span-2 lg:col-span-2">
                      <Input
                        label="Summary Notes"
                        placeholder="Key directives, dates, or prep instructions"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button type="submit" variant="primary" className="w-full">
                        <Plus className="h-3.5 w-3.5" /> Schedule Hearing
                      </Button>
                    </div>
                  </form>

                  {/* List of hearings */}
                  <div className="space-y-3">
                    {details?.hearings?.map((h) => (
                      <Card key={h.id} className="p-4 border border-brand-gold/10 transition-all hover:border-brand-gold/20">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex gap-3 items-start">
                            <Calendar className="h-5 w-5 text-brand-gold shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-bold text-brand-blue-dark">
                                {new Date(h.hearing_date).toLocaleDateString("en-IN", {
                                  weekday: "long",
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-brand-blue-light/50">
                                {h.courtroom && <span>Courtroom: {h.courtroom}</span>}
                                {h.judge && <span>Judge: {h.judge}</span>}
                                {h.purpose && <span>Purpose: {h.purpose}</span>}
                              </div>
                              {h.notes && <p className="mt-2 text-xs bg-base-200/50 p-2.5 rounded-lg border border-brand-gold/5 whitespace-pre-line">{h.notes}</p>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-start">
                            <Badge tone={h.status === "scheduled" ? "gold" : "muted"}>{h.status}</Badge>
                            {h.status === "scheduled" && (
                              <Select
                                defaultValue="scheduled"
                                onChange={(e) => updateHearing.mutate({
                                  hearingId: h.id,
                                  status: e.target.value
                                })}
                                className="min-h-8 py-1 text-xs"
                              >
                                <option value="scheduled">Scheduled</option>
                                <option value="held">Held</option>
                                <option value="postponed">Postponed</option>
                                <option value="cancelled">Cancelled</option>
                              </Select>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
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
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <Card className="w-full max-w-lg p-6 relative animate-scale-up space-y-4">
            <button
              type="button"
              onClick={() => setShowInviteModal(false)}
              className="absolute right-4 top-4 text-brand-blue-light/50 hover:text-brand-blue-dark"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex gap-3 items-center border-b border-brand-gold/12 pb-3">
              <Briefcase className="h-6 w-6 text-brand-gold" />
              <div>
                <h3 className="font-serif text-xl font-bold">Invite Client & Create Case</h3>
                <p className="text-xs text-brand-blue-light/55">Create a case timeline and invite the client via email.</p>
              </div>
            </div>

            <form onSubmit={handleCreateMatter} className="space-y-4">
              <Input
                label="Case Title / Matter Name"
                placeholder="e.g. Ramesh Sharma - Cheque Bounce Issue"
                value={newMatter.title}
                onChange={(e) => setNewMatter({ ...newMatter, title: e.target.value })}
                required
              />

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  type="email"
                  label="Client Email Address"
                  placeholder="e.g. client@example.com"
                  value={newMatter.client_email}
                  onChange={(e) => setNewMatter({ ...newMatter, client_email: e.target.value })}
                  required
                />
                <Input
                  label="Client Phone / WhatsApp"
                  placeholder="e.g. +91 98765 43210"
                  value={newMatter.client_phone}
                  onChange={(e) => setNewMatter({ ...newMatter, client_phone: e.target.value })}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  label="Category"
                  value={newMatter.category}
                  onChange={(e) => setNewMatter({ ...newMatter, category: e.target.value })}
                >
                  <option value="cheque_bounce">Cheque Bounce (Sec 138)</option>
                  <option value="rera">RERA Dispute</option>
                  <option value="consumer">Consumer Court Grievance</option>
                  <option value="property">Property Partition / Possession</option>
                  <option value="family">Family/Divorce Matter</option>
                  <option value="criminal">Criminal Defense</option>
                  <option value="other">Other Civil Dispute</option>
                </Select>
                <Select
                  label="Priority"
                  value={newMatter.priority}
                  onChange={(e) => setNewMatter({ ...newMatter, priority: e.target.value as MatterPriority })}
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Court Name (Optional)"
                  placeholder="e.g. Bombay High Court"
                  value={newMatter.court_name}
                  onChange={(e) => setNewMatter({ ...newMatter, court_name: e.target.value })}
                />
                <Input
                  label="Case/CNR Number (Optional)"
                  placeholder="e.g. CNR-MH-1092-2026"
                  value={newMatter.case_number}
                  onChange={(e) => setNewMatter({ ...newMatter, case_number: e.target.value })}
                />
              </div>

              <Textarea
                label="Case Description / Summary"
                placeholder="Details about the dispute, legal actions, and status..."
                value={newMatter.summary}
                onChange={(e) => setNewMatter({ ...newMatter, summary: e.target.value })}
              />

              <div className="flex gap-3 justify-end pt-3">
                <Button variant="ghost" onClick={() => setShowInviteModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={createMatter.isPending}>
                  {createMatter.isPending ? "Creating..." : "Create Case & Invite"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
