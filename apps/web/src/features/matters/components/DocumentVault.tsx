"use client";
import { useState, useRef } from "react";
import { FileText, Upload, Download, Loader2, File as FileIcon, X } from "lucide-react";
import { useMatterDocuments, useUploadDocument, useGetDownloadUrl } from "../hooks/useDocuments";

export function DocumentVault({ matterId }: { matterId: string }) {
  const { data: documents = [], isLoading } = useMatterDocuments(matterId);
  const uploadDoc = useUploadDocument();
  const getDownloadUrl = useGetDownloadUrl();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (max 10MB to match bucket config)
    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large. Maximum size is 10MB.");
      return;
    }
    
    setUploading(true);
    try {
      await uploadDoc.mutateAsync({ matterId, file });
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (filename: string, id: string) => {
    setDownloadingId(id);
    try {
      const { url } = await getDownloadUrl.mutateAsync({ matterId, filename });
      // Create a temporary link to trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert("Failed to download file.");
    } finally {
      setDownloadingId(null);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Filter out any hidden/system files like .emptyFolderPlaceholder
  const visibleDocs = documents.filter(d => !d.name.startsWith('.'));

  return (
    <div className="rounded-xl border border-brand-gold/12 bg-base-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-brand-gold/8">
        <div>
          <h2 className="font-serif text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-brand-gold" />
            Document Vault
          </h2>
          <p className="mt-1 text-xs text-brand-blue-light/50">Securely share files with your legal advisor.</p>
        </div>
        
        <div className="relative">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange} 
            className="hidden" 
            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="shimmer-btn flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-blue-dark hover:bg-brand-gold-light disabled:opacity-50 transition-all"
          >
            {uploading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
            ) : (
              <><Upload className="h-4 w-4" /> Upload File</>
            )}
          </button>
        </div>
      </div>
      
      <div className="p-5">
        {isLoading ? (
          <div className="flex justify-center py-8"><div className="h-6 w-6 rounded-full border-2 border-brand-gold/25 border-t-brand-gold animate-spin" /></div>
        ) : visibleDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold/5 mb-3">
              <FileIcon className="h-5 w-5 text-brand-gold/40" />
            </div>
            <p className="text-sm font-medium text-brand-blue-light/60">No documents yet</p>
            <p className="mt-1 text-xs text-brand-blue-light/40">Upload files like FIRs, notices, or evidence here.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleDocs.map(doc => (
              <div key={doc.id} className="flex items-start gap-3 rounded-xl border border-brand-gold/10 bg-base-200/50 p-3 transition-colors hover:border-brand-gold/25 hover:bg-base-200">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gold/10 text-brand-gold">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold" title={doc.name}>{doc.name}</p>
                  <p className="mt-0.5 text-[11px] text-brand-blue-light/50">
                    {formatSize(doc.metadata?.size)} • {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button 
                  onClick={() => handleDownload(doc.name, doc.id)}
                  disabled={downloadingId === doc.id}
                  className="shrink-0 p-1.5 text-brand-blue-light/40 hover:text-brand-gold hover:bg-brand-gold/10 rounded-md transition-colors"
                  title="Download file"
                >
                  {downloadingId === doc.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-brand-gold" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
