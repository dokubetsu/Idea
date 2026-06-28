import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api/client";
import type { Fact, Matter, MatterEvent, MatterUpdate } from "@/entities/types";
import { useToast } from "@/shared/components/ui/Toast";

export const matterKeys = {
  all:     ()         => ["matters"] as const,
  list:    (f?: object) => ["matters", "list", f] as const,
  detail:  (id: string) => ["matters", "detail", id] as const,
  facts:   (id: string) => ["matters", id, "facts"] as const,
  updates: (id: string) => ["matters", id, "updates"] as const,
  events:  (id: string) => ["matters", id, "events"] as const,
};

export function useMatters(filters?: { status?: string; category?: string; cursor?: string; limit?: string }) {
  const qs = filters ? "?" + new URLSearchParams(filters as Record<string,string>).toString() : "";
  return useQuery({
    queryKey: matterKeys.list(filters),
    queryFn:  () => apiClient.get<Matter[]>(`/matters${qs}`),
  });
}

export function useMatter(id: string) {
  return useQuery({
    queryKey: matterKeys.detail(id),
    queryFn:  () => apiClient.get<Matter>(`/matters/${id}`),
    enabled:  !!id,
  });
}

export function useFacts(matterId: string) {
  return useQuery({
    queryKey: matterKeys.facts(matterId),
    queryFn:  () => apiClient.get<Fact[]>(`/matters/${matterId}/facts`),
    enabled:  !!matterId,
  });
}

export function useVerifyFact(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ factId, value, is_verified }: { factId: string; value?: string; is_verified: boolean }) =>
      apiClient.patch<Fact>(`/matters/${matterId}/facts/${factId}`, { value, is_verified }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matterKeys.facts(matterId) });
      toast.success("Fact verification updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.detail || "Failed to update fact verification");
    },
  });
}

export function useUpdates(matterId: string) {
  return useQuery({
    queryKey: matterKeys.updates(matterId),
    queryFn:  () => apiClient.get<MatterUpdate[]>(`/matters/${matterId}/updates`),
    enabled:  !!matterId,
  });
}

export function usePostUpdate(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (body: { content: string; is_internal?: boolean; parent_id?: string }) =>
      apiClient.post<MatterUpdate>(`/matters/${matterId}/updates`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matterKeys.updates(matterId) });
      toast.success("Case update posted successfully");
    },
    onError: (err: any) => {
      toast.error(err.detail || "Failed to post case update");
    },
  });
}

export function useCreateMatter() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (body: {
      title: string;
      summary?: string;
      category: string;
      priority?: string;
      client_email: string;
      client_phone?: string;
      court_name?: string;
      case_number?: string;
    }) => apiClient.post<Matter>(`/matters`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matterKeys.all() });
      toast.success("Matter created successfully");
    },
    onError: (err: any) => {
      toast.error(err.detail || "Failed to create matter");
    },
  });
}

export function useCreateHearing(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (body: {
      hearing_date: string;
      courtroom?: string;
      judge?: string;
      purpose?: string;
      notes?: string;
      status?: string;
    }) => apiClient.post(`/matters/${matterId}/hearings`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matterKeys.detail(matterId) });
      toast.success("Hearing scheduled successfully");
    },
    onError: (err: any) => {
      toast.error(err.detail || "Failed to schedule hearing");
    },
  });
}

export function useUpdateHearing(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ hearingId, ...body }: {
      hearingId: string;
      hearing_date?: string;
      courtroom?: string;
      judge?: string;
      purpose?: string;
      notes?: string;
      status?: string;
    }) => apiClient.patch(`/matters/${matterId}/hearings/${hearingId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matterKeys.detail(matterId) });
      toast.success("Hearing details updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.detail || "Failed to update hearing");
    },
  });
}

export function useCreateMilestone(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (body: {
      title: string;
      description?: string;
      order_index: number;
      status?: string;
      amount_inr?: number;
    }) => apiClient.post(`/matters/${matterId}/milestones`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matterKeys.detail(matterId) });
      toast.success("Milestone created successfully");
    },
    onError: (err: any) => {
      toast.error(err.detail || "Failed to create milestone");
    },
  });
}

export function useUpdateMilestone(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ milestoneId, ...body }: {
      milestoneId: string;
      title?: string;
      description?: string;
      order_index?: number;
      status?: string;
      amount_inr?: number;
      is_paid?: boolean;
      payment_gateway_ref?: string;
      payment_record_id?: string;
      payment_idempotency_key?: string | null;
      completed_at?: string | null;
    }) => apiClient.patch(`/matters/${matterId}/milestones/${milestoneId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matterKeys.detail(matterId) });
      toast.success("Milestone updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.detail || "Failed to update milestone");
    },
  });
}

export function useMatterEvents(matterId: string) {
  return useQuery({
    queryKey: matterKeys.events(matterId),
    queryFn:  () => apiClient.get<MatterEvent[]>(`/matters/${matterId}/events`),
    enabled:  !!matterId,
  });
}

export function useCreateMeeting(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (body: {
      scheduled_at: string;
      duration_minutes?: number;
      notes?: string;
      meeting_link?: string;
    }) => apiClient.post(`/matters/${matterId}/meetings`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matterKeys.detail(matterId) });
      toast.success("Meeting scheduled successfully");
    },
    onError: (err: any) => {
      toast.error(err.detail || "Failed to schedule meeting");
    },
  });
}

export function useUpdateMeeting(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ meetingId, ...body }: {
      meetingId: string;
      scheduled_at?: string;
      duration_minutes?: number;
      status?: string;
      notes?: string;
      meeting_link?: string;
    }) => apiClient.patch(`/matters/${matterId}/meetings/${meetingId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matterKeys.detail(matterId) });
      toast.success("Meeting updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.detail || "Failed to update meeting");
    },
  });
}

export function useTriggerPaymentWebhook(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (body: {
      event: string;
      payload: {
        payment: {
          entity: {
            id: string;
            notes: {
              milestone_id: string;
              payment_idempotency_key: string;
            };
          };
        };
      };
    }) =>
      apiClient.post(`/matters/webhook/payment`, body, {
        headers: {
          ...(process.env.NODE_ENV !== "production" ? { "X-Razorpay-Signature": "mock" } : {}),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matterKeys.detail(matterId) });
      toast.success("Payment simulated successfully");
    },
    onError: (err: any) => {
      toast.error(err.detail || "Payment simulation failed");
    },
  });
}
