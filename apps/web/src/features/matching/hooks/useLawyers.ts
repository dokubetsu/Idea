import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api/client";
import { useToast } from "@/shared/components/ui/Toast";
import type { LawyerProfile } from "@/entities/types";

interface LawyerFilters { city?: string; state?: string; specialization?: string; min_experience?: number; max_fee?: number; available_only?: boolean; page?: number; per_page?: number; }

export function useLawyers(filters?: LawyerFilters) {
  const toast = useToast();
  const qs = filters ? "?" + new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([,v]) => v !== undefined).map(([k,v]) => [k, String(v)]))
  ).toString() : "";
  const query = useQuery({
    queryKey: ["lawyers", filters],
    queryFn:  () => apiClient.get<LawyerProfile[]>(`/matching/lawyers${qs}`),
  });

  useEffect(() => {
    if (query.error) {
      toast.error(query.error.message || "Failed to load advocates");
    }
  }, [query.error, toast]);

  return query;
}

export function useContactLawyer() {
  const toast = useToast();
  return useMutation({
    mutationFn: ({ lawyerId, matterId, message }: { lawyerId: string; matterId?: string; message?: string }) =>
      apiClient.post(`/matching/lawyers/${lawyerId}/contact`, { matter_id: matterId, message }),
    onSuccess: () => {
      toast.success("Message sent to advocate successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send message to advocate");
    },
  });
}

export function useIncomingRequests() {
  const toast = useToast();
  const query = useQuery({
    queryKey: ["matching", "requests"],
    queryFn:  () => apiClient.get<unknown[]>("/matching/requests/incoming"),
  });

  useEffect(() => {
    if (query.error) {
      toast.error(query.error.message || "Failed to fetch incoming requests");
    }
  }, [query.error, toast]);

  return query;
}

export function useRespondToRequest() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ requestId, accept }: { requestId: string; accept: boolean }) =>
      apiClient.patch(`/matching/requests/${requestId}`, { accept }),
    onSuccess: (_, { accept }) => {
      qc.invalidateQueries({ queryKey: ["matching", "requests"] });
      toast.success(accept ? "Request accepted successfully" : "Request declined successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to respond to request");
    },
  });
}
