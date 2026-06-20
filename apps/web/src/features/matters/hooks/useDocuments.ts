import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDocumentUploadUrl,
  getDocumentDownloadUrl,
  listDocuments
} from "../api/documents";

export function useMatterDocuments(matterId: string) {
  return useQuery({
    queryKey: ["matters", matterId, "documents"],
    queryFn: () => listDocuments(matterId),
    enabled: !!matterId,
  });
}

export function useGetDownloadUrl() {
  return useMutation({
    mutationFn: ({ matterId, filename }: { matterId: string; filename: string }) => 
      getDocumentDownloadUrl(matterId, filename),
  });
}

// Helper to actually perform the upload to the pre-signed URL
export function useUploadDocument() {
  const qc = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ matterId, file }: { matterId: string; file: File }) => {
      // 1. Get pre-signed URL from our backend
      const { url } = await getDocumentUploadUrl(matterId, file.name, file.type);
      
      // 2. PUT the file directly to Supabase storage
      const res = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });
      
      if (!res.ok) {
        throw new Error(`Upload failed: ${res.statusText}`);
      }
      
      return file.name;
    },
    onSuccess: (_, { matterId }) => {
      qc.invalidateQueries({ queryKey: ["matters", matterId, "documents"] });
    },
  });
}
