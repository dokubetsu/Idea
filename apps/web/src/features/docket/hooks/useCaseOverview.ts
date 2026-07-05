import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/shared/components/ui/Toast";
import { docketKeys } from "./useLawyerDashboard";
import {
  getCaseOverview,
  getCaseTasks,
  getCaseTimeline,
  getCaseNotes,
  createTimeEntry,
  createNote,
  createTask,
  updateTask,
  askCaseAi,
  nudgeClient,
  scheduleHearing,
  listHearings,
  updateHearing,
  listDocuments,
  reviewDocument,
  updateDocumentNote,
  listMessages,
  sendMessage,
  getDocketDocumentDownloadUrl,
  listDocumentRequests,
  createDocumentRequest,
  cancelDocumentRequest,
  fulfillDocumentRequest,
} from "../api/case-overview";

export function useCaseOverview(matterId: string) {
  return useQuery({
    queryKey: docketKeys.overview(matterId),
    queryFn: () => getCaseOverview(matterId),
    enabled: !!matterId,
  });
}

export function useCaseTasks(matterId: string) {
  return useQuery({
    queryKey: docketKeys.tasks(matterId),
    queryFn: () => getCaseTasks(matterId),
    enabled: !!matterId,
  });
}

export function useCaseTimeline(matterId: string) {
  return useQuery({
    queryKey: docketKeys.timeline(matterId),
    queryFn: () => getCaseTimeline(matterId),
    enabled: !!matterId,
  });
}

export function useCaseNotes(matterId: string) {
  return useQuery({
    queryKey: docketKeys.notes(matterId),
    queryFn: () => getCaseNotes(matterId),
    enabled: !!matterId,
  });
}

export function useLogTime(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (data: { activity: string; hours: number }) => createTimeEntry(matterId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: docketKeys.overview(matterId) });
      qc.invalidateQueries({ queryKey: docketKeys.billing(matterId) });
      toast.success("Time entry logged");
    },
    onError: (err: any) => toast.error(err.detail || err.message || "Failed to log time"),
  });
}

export function useCreateNote(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (content: string) => createNote(matterId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: docketKeys.notes(matterId) });
      qc.invalidateQueries({ queryKey: docketKeys.overview(matterId) });
      toast.success("Note saved");
    },
    onError: (err: any) => toast.error(err.detail || err.message || "Failed to save note"),
  });
}

export function useCreateTask(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (data: { title: string; assigned_to?: string; due_date?: string }) =>
      createTask(matterId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: docketKeys.tasks(matterId) });
      qc.invalidateQueries({ queryKey: docketKeys.overview(matterId) });
      toast.success("Task created");
    },
    onError: (err: any) => toast.error(err.detail || err.message || "Failed to create task"),
  });
}

export function useToggleTask(matterId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, is_completed }: { taskId: string; is_completed: boolean }) =>
      updateTask(matterId, taskId, { is_completed }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: docketKeys.tasks(matterId) });
      qc.invalidateQueries({ queryKey: docketKeys.overview(matterId) });
    },
  });
}

export function useAskCaseAi(matterId: string) {
  return useMutation({
    mutationFn: (prompt: string) => askCaseAi(matterId, prompt),
  });
}

export function useNudgeClient(matterId: string) {
  const toast = useToast();
  return useMutation({
    mutationFn: (taskId: string) => nudgeClient(matterId, taskId),
    onSuccess: () => toast.success("Nudge sent to client"),
    onError: (err: any) => toast.error(err.detail || err.message || "Failed to send nudge"),
  });
}

export function useScheduleHearing(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (data: { hearing_date: string; courtroom?: string; judge?: string; purpose?: string }) =>
      scheduleHearing(matterId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: docketKeys.overview(matterId) });
      qc.invalidateQueries({ queryKey: docketKeys.lawyerDashboard() });
      toast.success("Hearing scheduled");
    },
    onError: (err: any) => toast.error(err.detail || err.message || "Failed to schedule hearing"),
  });
}

// ── Hearings ─────────────────────────────────────────────────────

export function useHearings(matterId: string) {
  return useQuery({
    queryKey: ["docket", matterId, "hearings"],
    queryFn: () => listHearings(matterId),
    enabled: !!matterId,
  });
}

export function useUpdateHearing(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ hearingId, ...data }: { hearingId: string; status?: string; notes?: string; outcome?: string; next_date?: string }) =>
      updateHearing(matterId, hearingId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docket", matterId, "hearings"] });
      qc.invalidateQueries({ queryKey: docketKeys.overview(matterId) });
      toast.success("Hearing updated");
    },
    onError: (err: any) => toast.error(err.detail || err.message || "Failed to update hearing"),
  });
}

// ── Documents ────────────────────────────────────────────────────

export function useDocuments(matterId: string) {
  return useQuery({
    queryKey: ["docket", matterId, "documents"],
    queryFn: () => listDocuments(matterId),
    enabled: !!matterId,
  });
}

export function useReviewDocument(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ docId, ...data }: { docId: string; status: string; lawyer_note?: string }) =>
      reviewDocument(matterId, docId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docket", matterId, "documents"] });
      toast.success("Document reviewed");
    },
    onError: (err: any) => toast.error(err.detail || err.message || "Failed to review document"),
  });
}

export function useUpdateDocumentNote(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ docId, note }: { docId: string; note: string }) =>
      updateDocumentNote(matterId, docId, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docket", matterId, "documents"] });
      toast.success("Note saved");
    },
    onError: (err: any) => toast.error(err.detail || err.message || "Failed to save note"),
  });
}

// ── Messages ─────────────────────────────────────────────────────

export function useMessages(matterId: string) {
  return useQuery({
    queryKey: ["docket", matterId, "messages"],
    queryFn: () => listMessages(matterId),
    enabled: !!matterId,
    refetchInterval: 15000, // Poll every 15s for new messages
  });
}

export function useSendMessage(matterId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { content: string; message_type?: string }) =>
      sendMessage(matterId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docket", matterId, "messages"] });
    },
  });
}

// ── Document Download ───────────────────────────────────────────

export function useDownloadDocument(matterId: string) {
  const toast = useToast();
  return useMutation({
    mutationFn: (docId: string) => getDocketDocumentDownloadUrl(matterId, docId),
    onSuccess: ({ url }) => {
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    onError: (err: any) => toast.error(err.detail || err.message || "Failed to download document"),
  });
}

// ── Document Requests ────────────────────────────────────────────

export function useDocumentRequests(matterId: string) {
  return useQuery({
    queryKey: ["docket", matterId, "document-requests"],
    queryFn: () => listDocumentRequests(matterId),
    enabled: !!matterId,
  });
}

export function useCreateDocumentRequest(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (data: { title: string; description?: string; label: string }) =>
      createDocumentRequest(matterId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docket", matterId, "document-requests"] });
      toast.success("Document request sent to client");
    },
    onError: (err: any) => toast.error(err.detail || err.message || "Failed to request document"),
  });
}

export function useCancelDocumentRequest(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (requestId: string) => cancelDocumentRequest(matterId, requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docket", matterId, "document-requests"] });
      toast.success("Request cancelled");
    },
    onError: (err: any) => toast.error(err.detail || err.message || "Failed to cancel request"),
  });
}

export function useFulfillDocumentRequest(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ requestId, file }: { requestId: string; file: File }) =>
      fulfillDocumentRequest(matterId, requestId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docket", matterId, "document-requests"] });
      qc.invalidateQueries({ queryKey: ["docket", matterId, "documents"] });
      toast.success("Document uploaded");
    },
    onError: (err: any) => toast.error(err.detail || err.message || "Failed to upload document"),
  });
}