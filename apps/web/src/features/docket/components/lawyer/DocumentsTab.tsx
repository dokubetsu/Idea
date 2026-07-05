"use client";

import { useState } from "react";
import {
  FileText,
  Check,
  X,
  MessageSquare,
  Filter,
  Download,
  Loader2,
  FilePlus,
  Clock,
  CheckCircle2,
  Ban,
} from "lucide-react";
import {
  Card,
  Button,
  Badge,
  StatusPill,
  Spinner,
  EmptyState,
  Input,
  Textarea,
  Select,
  cn,
} from "@/shared/components/ui";
import {
  useDocuments,
  useReviewDocument,
  useUpdateDocumentNote,
  useDownloadDocument,
  useDocumentRequests,
  useCreateDocumentRequest,
  useCancelDocumentRequest,
} from "@/features/docket/hooks/useCaseOverview";

// ── Types ───────────────────────────────────────────────────────

interface DocumentRecord {
  id: string;
  name: string;
  classification: string;
  uploaded_at: string;
  created_at?: string;
  metadata: {
    review_status: "approved" | "rejected" | "under_review";
    lawyer_note?: string;
  };
}

interface DocumentRequestRecord {
  id: string;
  title: string;
  description?: string | null;
  label: "evidence" | "research" | "other";
  status: "pending" | "fulfilled" | "cancelled";
  created_at: string;
}

type StatusFilter = "all" | "under_review" | "approved" | "rejected";

interface Props {
  matterId: string;
}

// ── Constants ───────────────────────────────────────────────────

const STATUS_TONE: Record<string, "gold" | "teal" | "red"> = {
  under_review: "gold",
  approved: "teal",
  rejected: "red",
};

const STATUS_LABEL: Record<string, string> = {
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
};

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const LABEL_TEXT: Record<string, string> = {
  evidence: "Evidence",
  research: "Research",
  other: "Other",
};

const REQUEST_STATUS_TONE: Record<string, "gold" | "teal" | "muted"> = {
  pending: "gold",
  fulfilled: "teal",
  cancelled: "muted",
};

// ── Component ───────────────────────────────────────────────────

export default function DocumentsTab({ matterId }: Props) {
  const { data: documents, isLoading } = useDocuments(matterId);
  const reviewMutation = useReviewDocument(matterId);
  const noteMutation = useUpdateDocumentNote(matterId);
  const downloadMutation = useDownloadDocument(matterId);

  const { data: requests, isLoading: requestsLoading } = useDocumentRequests(matterId);
  const createRequest = useCreateDocumentRequest(matterId);
  const cancelRequest = useCancelDocumentRequest(matterId);

  const [filter, setFilter] = useState<StatusFilter>("all");
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);

  const docs: DocumentRecord[] = (documents as DocumentRecord[]) ?? [];
  const filtered = filter === "all" ? docs : docs.filter((d) => d.metadata.review_status === filter);
  const requestList: DocumentRequestRecord[] = (requests as DocumentRequestRecord[]) ?? [];

  // ── Handlers ────────────────────────────────────────────────

  const handleReview = (docId: string, status: "approved" | "rejected") => {
    const lawyerNote = noteOpenId === docId && noteText.trim() ? noteText.trim() : undefined;
    reviewMutation.mutate(
      { docId, status, lawyer_note: lawyerNote },
      {
        onSuccess: () => {
          setNoteOpenId(null);
          setNoteText("");
        },
      }
    );
  };

  const handleSaveNote = (docId: string) => {
    if (!noteText.trim()) return;
    noteMutation.mutate(
      { docId, note: noteText.trim() },
      {
        onSuccess: () => {
          setNoteOpenId(null);
          setNoteText("");
        },
      }
    );
  };

  const toggleNote = (docId: string) => {
    if (noteOpenId === docId) {
      setNoteOpenId(null);
      setNoteText("");
    } else {
      setNoteOpenId(docId);
      setNoteText("");
    }
  };

  const handleDownload = (docId: string) => {
    setDownloadingId(docId);
    downloadMutation.mutate(docId, {
      onSettled: () => setDownloadingId(null),
    });
  };

  // ── Loading ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-6 w-6 text-brand-gold" />
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Document Requests */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-gold/8">
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
              Requests to Client
            </p>
            {requestList.length > 0 && (
              <Badge tone="muted" className="text-[10px]">
                {requestList.length}
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            variant={showRequestForm ? "ghost" : "secondary"}
            onClick={() => setShowRequestForm((v) => !v)}
            aria-label="Request a document from client"
          >
            {showRequestForm ? "Cancel" : (
              <>
                <FilePlus className="h-3.5 w-3.5" />
                Request Document
              </>
            )}
          </Button>
        </div>

        {showRequestForm && (
          <RequestDocumentForm
            isSubmitting={createRequest.isPending}
            onSubmit={(data) =>
              createRequest.mutate(data, {
                onSuccess: () => setShowRequestForm(false),
              })
            }
          />
        )}

        <div className="px-5 py-3">
          {requestsLoading ? (
            <div className="flex justify-center py-4">
              <Spinner className="h-4 w-4" />
            </div>
          ) : requestList.length === 0 ? (
            <p className="py-3 text-center text-xs text-brand-blue-light/45">
              No documents requested yet.
            </p>
          ) : (
            <div className="space-y-2">
              {requestList.map((req) => (
                <div
                  key={req.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-brand-gold/8 bg-brand-gold/[0.02] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-brand-blue-dark truncate">{req.title}</p>
                      <Badge tone="muted" className="text-[9px] shrink-0">
                        {LABEL_TEXT[req.label] ?? req.label}
                      </Badge>
                    </div>
                    {req.description && (
                      <p className="mt-0.5 text-[11px] text-brand-blue-light/55 truncate">
                        {req.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusPill tone={REQUEST_STATUS_TONE[req.status] ?? "gold"}>
                      {req.status === "pending" && <Clock className="h-3 w-3" />}
                      {req.status === "fulfilled" && <CheckCircle2 className="h-3 w-3" />}
                      {req.status === "cancelled" && <Ban className="h-3 w-3" />}
                      <span className="capitalize">{req.status}</span>
                    </StatusPill>
                    {req.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => cancelRequest.mutate(req.id)}
                        disabled={cancelRequest.isPending}
                        aria-label={`Cancel request: ${req.title}`}
                        className="text-[11px] text-brand-blue-light/40 hover:text-red-500 transition-colors disabled:opacity-40"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Documents table */}
      <Card className="overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-gold/8">
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
              Client Documents
            </p>
            <Badge tone="muted" className="text-[10px]">
              {filtered.length}
            </Badge>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-brand-gold/6 bg-brand-gold/[0.02]">
          <Filter className="h-3.5 w-3.5 text-brand-blue-light/40" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50 mr-1">
            Status
          </span>
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              aria-label={`Filter by ${opt.label}`}
              className={cn(
                "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-all",
                filter === opt.value
                  ? "border-brand-gold/40 bg-brand-gold/12 text-brand-gold"
                  : "border-black/8 bg-white text-brand-blue-light/50 hover:border-brand-gold/20 hover:text-brand-gold/70"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {docs.length === 0 ? (
          <div className="px-5 py-12">
            <EmptyState
              icon={FileText}
              title="No Documents"
              body="No client documents have been uploaded for this matter yet."
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-brand-blue-light/45">
              No documents match the selected filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-brand-gold/8 bg-brand-gold/[0.02]">
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">
                    Exhibit
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">
                    Name
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">
                    Category
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50">
                    Uploaded
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/50 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-gold/6">
                {filtered.map((doc, index) => {
                  const reviewStatus = doc.metadata.review_status;
                  const isNoteOpen = noteOpenId === doc.id;
                  const isReviewing = reviewMutation.isPending;
                  const isDownloading = downloadingId === doc.id;
                  const uploadedAt = doc.uploaded_at || doc.created_at;

                  return (
                    <tr
                      key={doc.id}
                      className="group hover:bg-brand-gold/4 transition-colors"
                    >
                      {/* Exhibit number */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center justify-center rounded bg-brand-gold/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-gold">
                          P-{index + 1}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-brand-blue-light/30 shrink-0" />
                          <span className="text-sm font-medium text-brand-blue-dark max-w-[200px] truncate">
                            {doc.name}
                          </span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 text-xs text-brand-blue-light/60 capitalize">
                        {doc.classification}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusPill tone={STATUS_TONE[reviewStatus] ?? "gold"}>
                          {STATUS_LABEL[reviewStatus] ?? reviewStatus}
                        </StatusPill>
                      </td>

                      {/* Upload date */}
                      <td className="px-4 py-3 text-xs text-brand-blue-light/55 whitespace-nowrap">
                        {uploadedAt
                          ? new Date(uploadedAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Download */}
                          <button
                            onClick={() => handleDownload(doc.id)}
                            disabled={isDownloading}
                            aria-label={`Download ${doc.name}`}
                            className="rounded-md p-1.5 text-brand-blue-light/40 transition-colors hover:bg-brand-gold/10 hover:text-brand-gold disabled:opacity-40"
                          >
                            {isDownloading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* Note toggle */}
                          <button
                            onClick={() => toggleNote(doc.id)}
                            aria-label="Add note"
                            className={cn(
                              "rounded-md p-1.5 transition-colors",
                              isNoteOpen
                                ? "bg-brand-accent/10 text-brand-accent"
                                : "text-brand-blue-light/40 hover:text-brand-accent hover:bg-brand-accent/5"
                            )}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </button>

                          {/* Approve */}
                          {reviewStatus !== "approved" && (
                            <button
                              onClick={() => handleReview(doc.id, "approved")}
                              disabled={isReviewing}
                              aria-label="Approve document"
                              className="rounded-md border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-600 transition-colors hover:bg-emerald-100 hover:border-emerald-300 disabled:opacity-40"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Reject */}
                          {reviewStatus !== "rejected" && (
                            <button
                              onClick={() => handleReview(doc.id, "rejected")}
                              disabled={isReviewing}
                              aria-label="Reject document"
                              className="rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 transition-colors hover:bg-red-100 hover:border-red-300 disabled:opacity-40"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Note textarea (expandable) */}
                        {isNoteOpen && (
                          <div className="mt-2 flex flex-col gap-1.5">
                            <textarea
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              placeholder="Add lawyer note..."
                              aria-label="Lawyer note"
                              rows={2}
                              className="w-full resize-none rounded-md border border-brand-gold/20 bg-white px-2.5 py-1.5 text-xs text-brand-blue-dark placeholder:text-brand-blue-light/35 focus:border-brand-gold/40 focus:outline-none focus:ring-1 focus:ring-brand-gold/20"
                            />
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleSaveNote(doc.id)}
                                disabled={!noteText.trim() || noteMutation.isPending}
                                aria-label="Save note"
                                className="text-[10px]"
                              >
                                Save Note
                              </Button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Request Document Form ────────────────────────────────────────

interface RequestDocumentFormProps {
  isSubmitting: boolean;
  onSubmit: (data: { title: string; description?: string; label: string }) => void;
}

function RequestDocumentForm({ isSubmitting, onSubmit }: RequestDocumentFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [label, setLabel] = useState("evidence");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), description: description.trim() || undefined, label });
    setTitle("");
    setDescription("");
    setLabel("evidence");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 border-b border-brand-gold/8 bg-brand-gold/[0.02] px-5 py-4"
    >
      <Input
        label="Document Title"
        placeholder="e.g. Bank statement (last 6 months)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <Textarea
        label="Description (optional)"
        placeholder="Add any details the client should know about this document"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
      />
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Select label="Label" value={label} onChange={(e) => setLabel(e.target.value)}>
            <option value="evidence">Evidence</option>
            <option value="research">Research</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <Button
          type="submit"
          variant="gold"
          size="sm"
          disabled={!title.trim() || isSubmitting}
          className="shrink-0"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Request"}
        </Button>
      </div>
    </form>
  );
}
