import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api/client";
import type { IntakeSession } from "@/entities/types";

export const intakeKeys = {
  session: (id: string) => ["intake", "session", id] as const,
};

export function useStartIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; description: string }) =>
      apiClient.post<IntakeSession>("/intake/start", body),
    onSuccess: (data) => {
      qc.setQueryData(intakeKeys.session(data.id), data);
    },
  });
}

export function useIntakeSession(id: string | null) {
  return useQuery({
    queryKey: intakeKeys.session(id ?? ""),
    queryFn:  () => apiClient.get<IntakeSession>(`/intake/${id}`),
    enabled:  !!id,
  });
}

export function useUpdateFacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, facts }: { sessionId: string; facts: IntakeSession["extracted_facts"]["facts"] }) =>
      apiClient.patch<IntakeSession>(`/intake/${sessionId}/facts`, { facts }),
    onSuccess: (data, variables) => qc.setQueryData(intakeKeys.session(variables.sessionId), data),
  });
}

export function useRunAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => apiClient.post<IntakeSession>(`/intake/${sessionId}/assess`, {}),
    onSuccess: (data, sessionId) => qc.setQueryData(intakeKeys.session(sessionId), data),
  });
}

export function useCommitIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, confirmed_facts }: { sessionId: string; confirmed_facts: any[] }) =>
      apiClient.post<{ matter_id: string; status: string }>(`/intake/${sessionId}/commit`, { confirmed_facts }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["matters"] });
    },
  });
}

