"use client";

import { useState } from "react";
import { FileText, Check, X, MessageSquare, Filter } from "lucide-react";
import {
  Card,
  Button,
  Badge,
  StatusPill,
  Spinner,
  EmptyState,
  cn,
} from "@/shared/components/ui";
import {
  useDocuments,
  useReviewDocument,
  useUpdateDocumentNote,
} from "@/features/docket/hooks/useCaseOverview";

// ── Types ───────────────────────────────────────────────────────

interface DocumentRecord {
  id: string;
  name: string;
  classification: string;
  uploaded_at: string;
  metadata: {
    review_status: "approved" | "rejected" | "under_review";
    lawyer_note?: string;
  };
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

// ── Component ───────────────────────────────────────────────────

export default function DocumentsTab({ matterId }: Props) {
  const { data: documents, isLoading } = useDocuments(matterId);
  const reviewMutation = useReviewDocument(matterId);
  const noteMutation = useUpdateDocumentNote(matterId);

  const [filter, setFilter] = useState<StatusFilter>("all");
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const docs: DocumentRecord[] = (documents as DocumentRecord[]) ?? [];
  const filtered = filter === "all" ? docs : docs.filter((d) => d.metadata.review_status === filter);

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

  // ── Loading ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-6 w-6 text-brand-gold" />
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────

  if (docs.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={FileText}
          title="No Documents"
          body="No client documents have been uploaded for this matter yet."
        />
      </Card>
    );
  }

  // ── Main render ─────────────────────────────────────────────

  return (
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

      {/* Table */}
      {filtered.length === 0 ? (
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
                      {new Date(doc.uploaded_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
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
  );
}
