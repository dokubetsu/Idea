"use client";

import { FileText, Upload, Download, CheckCircle, XCircle, Clock, FileUp } from "lucide-react";
import { useDocuments } from "@/features/docket/hooks/useCaseOverview";
import { Card, Badge, Spinner, EmptyState } from "@/shared/components/ui";

interface Props {
  matterId: string;
}

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

export default function ClientDocumentsTab({ matterId }: Props) {
  const { data: documents = [], isLoading } = useDocuments(matterId);

  const sharedDocs = documents.filter(
    (doc: any) => doc.uploaded_by !== "client"
  );
  const myUploads = documents.filter(
    (doc: any) => doc.uploaded_by === "client"
  );

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
                  aria-label={`Download ${doc.name}`}
                  className="shrink-0 rounded-lg p-2 text-brand-blue-light/40 transition-colors hover:bg-brand-gold/10 hover:text-brand-gold"
                >
                  <Download className="h-4 w-4" />
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
