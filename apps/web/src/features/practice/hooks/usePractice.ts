import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/shared/components/ui/Toast";
import * as api from "../api/practice";

export const practiceKeys = {
  scenarios: (filters?: object) => ["practice", "scenarios", filters] as const,
  session: (id: string) => ["practice", "session", id] as const,
  debrief: (id: string) => ["practice", "debrief", id] as const,
  profile: () => ["practice", "profile"] as const,
  history: (filters?: object) => ["practice", "history", filters] as const,
};

export function useScenarios(filters?: {
  domain?: string;
  difficulty?: string;
  page?: number;
  perPage?: number;
}) {
  return useQuery({
    queryKey: practiceKeys.scenarios(filters),
    queryFn: () => api.listScenarios(filters),
  });
}

export function useSession(sessionId: string) {
  return useQuery({
    queryKey: practiceKeys.session(sessionId),
    queryFn: () => api.getSession(sessionId),
    enabled: !!sessionId,
  });
}

export function useStartSession() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (scenarioKey: string) => api.startSession(scenarioKey),
    onSuccess: (data) => {
      qc.setQueryData(practiceKeys.session(data.id), data);
      qc.invalidateQueries({ queryKey: ["practice", "history"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to start practice session");
    },
  });
}

export function useSubmitDecision(sessionId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (data: { choiceId: string; inputValue?: any; timeTakenMs?: number }) =>
      api.submitDecision(sessionId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["practice", "session", sessionId] });
      qc.invalidateQueries({ queryKey: ["practice", "profile"] });
      qc.invalidateQueries({ queryKey: ["practice", "debrief", sessionId] });
      qc.invalidateQueries({ queryKey: ["practice", "history"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit decision");
    },
  });
}

export function useDebrief(sessionId: string) {
  return useQuery({
    queryKey: practiceKeys.debrief(sessionId),
    queryFn: () => api.getDebrief(sessionId),
    enabled: !!sessionId,
  });
}

export function usePracticeProfile() {
  return useQuery({
    queryKey: practiceKeys.profile(),
    queryFn: () => api.getProfile(),
  });
}

export function usePracticeHistory(filters?: { page?: number; perPage?: number }) {
  return useQuery({
    queryKey: practiceKeys.history(filters),
    queryFn: () => api.getHistory(filters),
  });
}
