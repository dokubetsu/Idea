"use client";

import { useState } from "react";
import { FileText, Copy, Check, Edit3, Eye, Loader2, Download } from "lucide-react";
import { Card, Button, Spinner } from "@/shared/components/ui";
import { apiClient } from "@/shared/lib/api/client";
import type { MatterCategory } from "@/entities/types";

interface DocumentDraftCardProps {
  matterId: string;
  category: MatterCategory;
}

export function DocumentDraftCard({ matterId, category }: DocumentDraftCardProps) {
  const [docType, setDocType] = useState<string>("vakalatnama");
  const [draftContent, setDraftContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Available documents based on matter category
  const availableDocs = [
    { value: "vakalatnama", label: "Vakalatnama (Lawyer Authorization)" },
    ...(category === "cheque_bounce"
      ? [{ value: "legal_notice_138", label: "Section 138 NI Act Legal Notice" }]
      : []),
    ...(category === "rera"
      ? [{ value: "rera_complaint_form_m", label: "RERA Complaint (Form M)" }]
      : []),
  ];

  async function generateDraft() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<{ draft_content: string }>("/legal-tools/documents/draft", {
        matter_id: matterId,
        document_type: docType,
      });
      setDraftContent(res.draft_content);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || "Failed to generate document draft.");
    } finally {
      setLoading(false);
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draftContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([draftContent], { type: "text/markdown" });
    const url = URL.createObjectURL(file);
    element.href = url;
    element.download = `${docType}_draft_${matterId.substring(0, 8)}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  };


  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between border-b border-brand-gold/12 pb-4">
        <div>
          <h3 className="font-serif text-lg font-bold">Statutory Document Drafts</h3>
          <p className="text-xs text-brand-blue-light/55 mt-0.5">
            Pre-populate, refine, and export standard legal documents.
          </p>
        </div>
        <FileText className="h-5 w-5 text-brand-gold" />
      </div>

      {/* Document Selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex-1">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-blue-light/50">
            Select Template
          </span>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            disabled={loading}
            className="min-h-10 w-full rounded-xl border border-brand-gold/15 bg-base-100 px-3 text-xs outline-none focus:border-brand-gold"
          >
            {availableDocs.map((doc) => (
              <option key={doc.value} value={doc.value}>
                {doc.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2 self-end mt-1 sm:mt-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={generateDraft}
            disabled={loading}
            className="text-xs"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : draftContent ? "Regenerate" : "Generate Draft"}
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-200 p-3 rounded-lg">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 border border-brand-gold/8 rounded-xl bg-brand-blue-dark/2">
          <Spinner className="h-8 w-8" />
          <p className="text-xs text-brand-blue-light/50">Compiling database facts...</p>
        </div>
      ) : draftContent ? (
        <div className="space-y-3">
          {/* Action Toolbar */}
          <div className="flex items-center justify-between bg-brand-blue-dark/5 p-2 rounded-lg border border-brand-gold/8">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  !isEditing
                    ? "bg-brand-blue-dark text-brand-gold shadow-sm"
                    : "text-brand-blue-dark/60 hover:bg-white/50"
                }`}
              >
                <Eye className="h-3.5 w-3.5" /> Preview
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  isEditing
                    ? "bg-brand-blue-dark text-brand-gold shadow-sm"
                    : "text-brand-blue-dark/60 hover:bg-white/50"
                }`}
              >
                <Edit3 className="h-3.5 w-3.5" /> Edit Template
              </button>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleCopy}
                title="Copy to Clipboard"
                className="rounded-lg p-2 text-brand-blue-light/60 hover:bg-white/50 hover:text-brand-blue-dark transition-all"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                title="Download Markdown File"
                className="rounded-lg p-2 text-brand-blue-light/60 hover:bg-white/50 hover:text-brand-blue-dark transition-all"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Document Content Display */}
          {isEditing ? (
            <textarea
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              className="w-full min-h-[350px] font-mono text-xs leading-relaxed p-4 rounded-xl border border-brand-gold/15 bg-base-100 focus:border-brand-gold focus:bg-white outline-none resize-y"
              placeholder="Edit your document draft here..."
            />
          ) : (
            <div className="relative overflow-hidden rounded-xl border border-amber-800/10 bg-[#fdfbf7] p-8 shadow-inner max-h-[450px] overflow-y-auto custom-scrollbar">
              {/* Stamped paper line decoration */}
              <div className="absolute left-6 top-0 bottom-0 w-px bg-red-700/15" />
              <div className="absolute left-6.5 top-0 bottom-0 w-px bg-red-700/15" />

              <div className="pl-6 font-serif text-[13px] leading-relaxed text-[#1a1a1a] whitespace-pre-wrap select-text selection:bg-brand-gold/30">
                {draftContent}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <FileText className="h-8 w-8 text-brand-gold/40" />
          <p className="text-xs text-brand-blue-light/40">
            Select a document type and click <strong>Generate Draft</strong> to populate it with your matter details.
          </p>
        </div>
      )}
    </Card>
  );
}
