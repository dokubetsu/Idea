import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/shared/components/ui/Toast";
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

export function useConsultations(params?: { status?: string; page?: number; per_page?: number }) {
  const toast = useToast();
  const query = useQuery({
    queryKey: ["consultations", params],
    queryFn: () => listConsultations(params),
  });

  useEffect(() => {
    if (query.error) {
      toast.error(query.error.message || "Failed to fetch consultations");
    }
  }, [query.error, toast]);

  return query;
}

export function useConsultation(id: string) {
  const toast = useToast();
  const query = useQuery({
    queryKey: ["consultations", id],
    queryFn: () => getConsultation(id),
    enabled: !!id,
  });

  useEffect(() => {
    if (query.error) {
      toast.error(query.error.message || "Failed to fetch consultation details");
    }
  }, [query.error, toast]);

  return query;
}

export function useCreateConsultation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (data: { lawyer_id?: string; package?: ConsultationPackage; notes?: string }) => createConsultation(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consultations"] });
      toast.success("Consultation request created successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create consultation request");
    },
  });
}

export function useConfirmConsultation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: confirmConsultation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consultations"] });
      qc.invalidateQueries({ queryKey: ["matters"] });
      toast.success("Consultation confirmed successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to confirm consultation");
    },
  });
}

export function useCancelConsultation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: cancelConsultation,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["consultations"] });
      qc.invalidateQueries({ queryKey: ["consultations", id] });
      toast.success("Consultation cancelled successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to cancel consultation");
    },
  });
}

export function useDeclineConsultation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: declineConsultation,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["consultations"] });
      qc.invalidateQueries({ queryKey: ["consultations", id] });
      toast.success("Consultation declined successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to decline consultation");
    },
  });
}

export function useUpdateConsultation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { notes?: string; scheduled_at?: string } }) => updateConsultation(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["consultations"] });
      qc.invalidateQueries({ queryKey: ["consultations", id] });
      toast.success("Consultation updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update consultation");
    },
  });
}
