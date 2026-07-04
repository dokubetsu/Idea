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
