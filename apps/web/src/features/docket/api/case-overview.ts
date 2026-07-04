import { apiClient } from "@/shared/lib/api/client";
import type { CaseTask, TimelineEvent, InternalNote, AiChatResponse } from "../types";

export const getCaseOverview = (matterId: string) =>
  apiClient.get<Record<string, unknown>>(`/docket/matters/${matterId}/overview`);

export const getCaseTasks = (matterId: string) =>
  apiClient.get<CaseTask[]>(`/docket/matters/${matterId}/tasks`);

export const getCaseTimeline = (matterId: string) =>
  apiClient.get<TimelineEvent[]>(`/docket/matters/${matterId}/timeline`);

export const getCaseNotes = (matterId: string) =>
  apiClient.get<InternalNote[]>(`/docket/matters/${matterId}/notes`);

export const createTimeEntry = (matterId: string, data: { activity: string; hours: number }) =>
  apiClient.post(`/docket/matters/${matterId}/time-entries`, data);

export const createNote = (matterId: string, content: string) =>
  apiClient.post(`/docket/matters/${matterId}/notes`, { content });

export const createTask = (matterId: string, data: { title: string; assigned_to?: string; due_date?: string }) =>
  apiClient.post(`/docket/matters/${matterId}/tasks`, data);

export const updateTask = (matterId: string, taskId: string, data: { is_completed?: boolean }) =>
  apiClient.patch(`/docket/matters/${matterId}/tasks/${taskId}`, data);

export const createTimelineEvent = (matterId: string, data: { event_type: string; lawyer_description: string; client_description?: string }) =>
  apiClient.post(`/docket/matters/${matterId}/timeline`, data);

export const askCaseAi = (matterId: string, prompt: string) =>
  apiClient.post<AiChatResponse>(`/docket/matters/${matterId}/ai-chat`, { prompt });
