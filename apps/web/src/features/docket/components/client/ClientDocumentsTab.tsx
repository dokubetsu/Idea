"use client";

import { useRef, useState } from "react";
import {
  FileText,
  Upload,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  FileUp,
  Loader2,
  Ban,
} from "lucide-react";
import {
  useDocuments,
  useDownloadDocument,
  useDocumentRequests,
  useFulfillDocumentRequest,
} from "@/features/docket/hooks/useCaseOverview";
import { Card, Badge, Button, Spinner, EmptyState } from "@/shared/components/ui";

interface Props {
  matterId: string;
}

interface DocumentRequestRecord {
  id: string;
  title: string;
  description?: string | null;
  label: "evidence" | "research" | "other";
  status: "pending" | "fulfilled" | "cancelled";
  created_at: string;
}

const LABEL_TEXT: Record<string, string> = {
  evidence: "Evidence",
  research: "Research",
  other: "Other",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ReviewStatusBadge({ status }: { status?: string }) {
  switch (status) {
    case "under_review":
      return (
        <Badge tone="gold">
          <Clock className="h-3 w-3" />
          Under Review
        </Badge>
      );
    case "approved":
      return (
        <Badge tone="teal">
          <CheckCircle className="h-3 w-3" />
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge tone="red">
          <XCircle className="h-3 w-3" />
          Rejected
        </Badge>
      );
    default:
      return null;
  }
}

function PendingRequestRow({
  request,
  matterId,
}: {
  request: DocumentRequestRecord;
  matterId: string;
}) {
  const fulfill = useFulfillDocumentRequest(matterId);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    fulfill.mutate(
      { requestId: request.id, file },
      {
        onSettled: () => {
          if (inputRef.current) inputRef.current.value = "";
        },
      }
    );
  };

  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-gold/20 bg-brand-gold/8">
          <FileUp className="h-4 w-4 text-brand-gold" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-brand-blue-dark">{request.title}</p>
            <Badge tone="muted" className="text-[9px] shrink-0">
              {LABEL_TEXT[request.label] ?? request.label}
            </Badge>
          </div>
          {request.description && (
            <p className="mt-0.5 text-[12px] leading-relaxed text-brand-blue-light/60">
              {request.description}
            </p>
          )}
        </div>
        <div className="shrink-0">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            aria-label={`Upload file for ${request.title}`}
          />
          <Button
            size="sm"
            variant="gold"
            onClick={() => inputRef.current?.click()}
            disabled={fulfill.isPending}
          >
            {fulfill.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function ClientDocumentsTab({ matterId }: Props) {
  const { data: documents = [], isLoading } = useDocuments(matterId);
  const { data: requests = [], isLoading: requestsLoading } = useDocumentRequests(matterId);
  const downloadMutation = useDownloadDocument(matterId);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = (docId: string) => {
    setDownloadingId(docId);
    downloadMutation.mutate(docId, { onSettled: () => setDownloadingId(null) });
  };

  const pendingRequests: DocumentRequestRecord[] = (requests as DocumentRequestRecord[]).filter(
    (r) => r.status === "pending"
  );

  const sharedDocs = documents.filter((doc: any) => !doc.uploaded_by_client);
  const myUploads = documents.filter((doc: any) => doc.uploaded_by_client);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Upload guidance */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-gold/20 bg-brand-gold/8">
            <FileUp className="h-4.5 w-4.5 text-brand-gold" />
          </div>
          <div>
            <p className="text-sm font-medium text-brand-blue-dark">
              Your lawyer may ask you to upload documents here.
            </p>
            <p className="mt-0.5 text-[11px] text-brand-blue-light/55">
              You will see requests below. Once uploaded, your lawyer will review
              them and let you know if anything else is needed.
            </p>
          </div>
        </div>
      </Card>

      {/* Section: Requested documents */}
      <section>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
          Requested from you
        </p>

        {requestsLoading ? (
          <div className="flex justify-center py-4">
            <Spinner className="h-4 w-4" />
          </div>
        ) : pendingRequests.length === 0 ? (
          <Card className="flex items-center gap-2 p-3 text-[12px] text-brand-blue-light/50">
            <Ban className="h-3.5 w-3.5" />
            No pending document requests right now.
          </Card>
        ) : (
          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <PendingRequestRow key={req.id} request={req} matterId={matterId} />
            ))}
          </div>
        )}
      </section>

      {/* Section: Documents shared with you */}
      <section>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
          Documents shared with you
        </p>

        {sharedDocs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nothing shared yet"
            body="When your lawyer shares documents with you, they will appear here."
          />
        ) : (
          <div className="space-y-2">
            {sharedDocs.map((doc: any) => (
              <Card key={doc.id} className="flex items-center gap-3 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gold/10 text-brand-gold">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-brand-blue-dark" title={doc.name}>
                    {doc.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-brand-blue-light/50">
                    {doc.classification && (
                      <span className="mr-1.5">{doc.classification}</span>
                    )}
                    {doc.classification && doc.created_at && <span>&#183; </span>}
                    {doc.created_at && formatDate(doc.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => handleDownload(doc.id)}
                  disabled={downloadingId === doc.id}
                  aria-label={`Download ${doc.name}`}
                  className="shrink-0 rounded-lg p-2 text-brand-blue-light/40 transition-colors hover:bg-brand-gold/10 hover:text-brand-gold disabled:opacity-40"
                >
                  {downloadingId === doc.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Section: Your uploads */}
      <section>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
          Your uploads
        </p>

        {myUploads.length === 0 ? (
          <EmptyState
            icon={Upload}
            title="No uploads yet"
            body="Documents you upload for your lawyer will show up here along with their review status."
          />
        ) : (
          <div className="space-y-2">
            {myUploads.map((doc: any) => {
              const reviewStatus = doc.metadata?.review_status as string | undefined;
              const lawyerNote = doc.metadata?.lawyer_note as string | undefined;

              return (
                <Card key={doc.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gold/10 text-brand-gold">
                      <Upload className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-brand-blue-dark" title={doc.name}>
                        {doc.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-brand-blue-light/50">
                        {doc.classification && (
                          <span className="mr-1.5">{doc.classification}</span>
                        )}
                        {doc.classification && doc.created_at && <span>&#183; </span>}
                        {doc.created_at && formatDate(doc.created_at)}
                      </p>
                    </div>
                    <ReviewStatusBadge status={reviewStatus} />
                    <button
                      onClick={() => handleDownload(doc.id)}
                      disabled={downloadingId === doc.id}
                      aria-label={`Download ${doc.name}`}
                      className="shrink-0 rounded-lg p-2 text-brand-blue-light/40 transition-colors hover:bg-brand-gold/10 hover:text-brand-gold disabled:opacity-40"
                    >
                      {downloadingId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* Lawyer note shown when rejected */}
                  {reviewStatus === "rejected" && lawyerNote && (
                    <div className="mt-2.5 ml-11 rounded-lg border border-red-500/15 bg-red-50/60 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-500/70">
                        Note from your lawyer
                      </p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-red-700/80">
                        {lawyerNote}
                      </p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
