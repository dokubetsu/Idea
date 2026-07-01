import { apiClient } from "@/shared/lib/api/client";
import type {
  ScenarioListResponse,
  SessionOut,
  DecisionResponse,
  DebriefResponse,
  PracticeProfileResponse,
  SessionHistoryItem,
} from "../types";

export async function listScenarios(params?: {
  domain?: string;
  difficulty?: string;
  page?: number;
  perPage?: number;
}): Promise<ScenarioListResponse> {
  const q = new URLSearchParams();
  if (params?.domain) q.append("domain", params.domain);
  if (params?.difficulty) q.append("difficulty", params.difficulty);
  if (params?.page) q.append("page", params.page.toString());
  if (params?.perPage) q.append("per_page", params.perPage.toString());

  const queryStr = q.toString() ? `?${q.toString()}` : "";
  return apiClient.get<ScenarioListResponse>(`/practice/scenarios${queryStr}`);
}

export async function startSession(scenarioKey: string): Promise<SessionOut> {
  return apiClient.post<SessionOut>("/practice/sessions", { scenario_key: scenarioKey });
}

export async function getSession(sessionId: string): Promise<SessionOut> {
  return apiClient.get<SessionOut>(`/practice/sessions/${sessionId}`);
}

export async function submitDecision(
  sessionId: string,
  data: {
    choiceId: string;
    inputValue?: any;
    timeTakenMs?: number;
  }
): Promise<DecisionResponse> {
  return apiClient.post<DecisionResponse>(`/practice/sessions/${sessionId}/decide`, {
    choice_id: data.choiceId,
    input_value: data.inputValue,
    time_taken_ms: data.timeTakenMs,
  });
}

export async function getDebrief(sessionId: string): Promise<DebriefResponse> {
  return apiClient.get<DebriefResponse>(`/practice/sessions/${sessionId}/debrief`);
}

export async function getProfile(): Promise<PracticeProfileResponse> {
  return apiClient.get<PracticeProfileResponse>("/practice/profile");
}

export async function getHistory(params?: {
  page?: number;
  perPage?: number;
}): Promise<SessionHistoryItem[]> {
  const q = new URLSearchParams();
  if (params?.page) q.append("page", params.page.toString());
  if (params?.perPage) q.append("per_page", params.perPage.toString());

  const queryStr = q.toString() ? `?${q.toString()}` : "";
  return apiClient.get<SessionHistoryItem[]>(`/practice/history${queryStr}`);
}
