import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api/client";
import type { LawyerProfile } from "@/entities/types";

interface LawyerFilters { city?: string; state?: string; specialization?: string; min_experience?: number; max_fee?: number; available_only?: boolean; }

export function useLawyers(filters?: LawyerFilters) {
  const qs = filters ? "?" + new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([,v]) => v !== undefined).map(([k,v]) => [k, String(v)]))
  ).toString() : "";
  return useQuery({
    queryKey: ["lawyers", filters],
    queryFn:  () => apiClient.get<LawyerProfile[]>(`/matching/lawyers${qs}`),
  });
}

export function useContactLawyer() {
  return useMutation({
    mutationFn: ({ lawyerId, matterId, message }: { lawyerId: string; matterId?: string; message?: string }) =>
      apiClient.post(`/matching/lawyers/${lawyerId}/contact`, { matter_id: matterId, message }),
  });
}

export function useIncomingRequests() {
  return useQuery({
    queryKey: ["matching", "requests"],
    queryFn:  () => apiClient.get<unknown[]>("/matching/requests/incoming"),
  });
}

export function useRespondToRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, accept }: { requestId: string; accept: boolean }) =>
      apiClient.patch(`/matching/requests/${requestId}`, { accept }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matching", "requests"] }),
  });
}
