import { apiClient } from "@/shared/lib/api/client";

export async function getDocumentUploadUrl(matterId: string, filename: string, contentType: string) {
  return apiClient.post<{ url: string }>(`/matters/${matterId}/documents/upload-url`, {
    filename,
    content_type: contentType
  });
}

export async function getDocumentDownloadUrl(matterId: string, filename: string) {
  return apiClient.get<{ url: string }>(`/matters/${matterId}/documents/${encodeURIComponent(filename)}`);
}

export async function listDocuments(matterId: string) {
  // Supabase returns an array of objects
  return apiClient.get<Array<{ name: string; id: string; updated_at: string; created_at: string; metadata: any }>>(`/matters/${matterId}/documents`);
}
