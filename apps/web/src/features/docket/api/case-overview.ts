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

export const nudgeClient = (matterId: string, taskId: string) =>
  apiClient.post(`/docket/matters/${matterId}/tasks/${taskId}/nudge`, {});

export const scheduleHearing = (
  matterId: string,
  data: { hearing_date: string; courtroom?: string; judge?: string; purpose?: string }
) => apiClient.post(`/docket/matters/${matterId}/hearings`, data);

export const listHearings = (matterId: string) =>
  apiClient.get<any[]>(`/docket/matters/${matterId}/hearings`);

export const updateHearing = (
  matterId: string,
  hearingId: string,
  data: { status?: string; notes?: string; outcome?: string; next_date?: string }
) => apiClient.patch(`/docket/matters/${matterId}/hearings/${hearingId}`, data);

export const listDocuments = (matterId: string) =>
  apiClient.get<any[]>(`/docket/matters/${matterId}/documents`);

export const reviewDocument = (
  matterId: string,
  docId: string,
  data: { status: string; lawyer_note?: string }
) => apiClient.patch(`/docket/matters/${matterId}/documents/${docId}/review`, data);

export const updateDocumentNote = (matterId: string, docId: string, lawyer_note: string) =>
  apiClient.patch(`/docket/matters/${matterId}/documents/${docId}/note`, { lawyer_note });

export const listMessages = (matterId: string) =>
  apiClient.get<any[]>(`/docket/matters/${matterId}/messages`);

export const sendMessage = (
  matterId: string,
  data: { content: string; message_type?: string; attachment_path?: string }
) => apiClient.post(`/docket/matters/${matterId}/messages`, data);

export const getDocketDocumentDownloadUrl = (matterId: string, docId: string) =>
  apiClient.get<{ url: string }>(`/docket/matters/${matterId}/documents/${docId}/download-url`);

export const listDocumentRequests = (matterId: string) =>
  apiClient.get<any[]>(`/docket/matters/${matterId}/document-requests`);

export const createDocumentRequest = (
  matterId: string,
  data: { title: string; description?: string; label: string }
) => apiClient.post(`/docket/matters/${matterId}/document-requests`, data);

export const cancelDocumentRequest = (matterId: string, requestId: string) =>
  apiClient.patch(`/docket/matters/${matterId}/document-requests/${requestId}/cancel`, {});

export const fulfillDocumentRequest = (
  matterId: string,
  requestId: string,
  file: File
) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.postForm(
    `/docket/matters/${matterId}/document-requests/${requestId}/fulfill`,
    formData
  );
};