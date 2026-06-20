import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listConsultations,
  getConsultation,
  createConsultation,
  confirmConsultation,
  cancelConsultation,
  declineConsultation,
  updateConsultation,
} from "../api/consultations";
import type { ConsultationPackage } from "@/entities/types";

export function useConsultations(params?: { status?: string }) {
  return useQuery({
    queryKey: ["consultations", params],
    queryFn: () => listConsultations(params),
  });
}

export function useConsultation(id: string) {
  return useQuery({
    queryKey: ["consultations", id],
    queryFn: () => getConsultation(id),
    enabled: !!id,
  });
}

export function useCreateConsultation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { lawyer_id?: string; package?: ConsultationPackage; notes?: string }) => createConsultation(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consultations"] });
    },
  });
}

export function useConfirmConsultation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: confirmConsultation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consultations"] });
      qc.invalidateQueries({ queryKey: ["matters"] });
    },
  });
}

export function useCancelConsultation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelConsultation,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["consultations"] });
      qc.invalidateQueries({ queryKey: ["consultations", id] });
    },
  });
}

export function useDeclineConsultation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: declineConsultation,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["consultations"] });
      qc.invalidateQueries({ queryKey: ["consultations", id] });
    },
  });
}

export function useUpdateConsultation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { notes?: string; scheduled_at?: string } }) => updateConsultation(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["consultations"] });
      qc.invalidateQueries({ queryKey: ["consultations", id] });
    },
  });
}
