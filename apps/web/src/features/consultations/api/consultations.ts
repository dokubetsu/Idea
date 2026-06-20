import { apiClient } from "@/shared/lib/api/client";
import type { Consultation, ConsultationPackage } from "@/entities/types";

export async function listConsultations(params?: { status?: string; page?: number; per_page?: number }) {
  const query = new URLSearchParams();
  if (params?.status) query.append("status", params.status);
  if (params?.page) query.append("page", params.page.toString());
  if (params?.per_page) query.append("per_page", params.per_page.toString());
  const qStr = query.toString() ? `?${query.toString()}` : "";
  return apiClient.get<Consultation[]>(`/consultations${qStr}`);
}

export async function getConsultation(id: string) {
  return apiClient.get<Consultation>(`/consultations/${id}`);
}

export async function createConsultation(data: { lawyer_id?: string; package?: ConsultationPackage; notes?: string }) {
  return apiClient.post<Consultation>("/consultations", data);
}

export async function confirmConsultation(id: string) {
  return apiClient.patch<{ matter_id: string; already_confirmed: boolean }>(`/consultations/${id}/confirm`, {});
}

export async function cancelConsultation(id: string) {
  return apiClient.patch<Consultation>(`/consultations/${id}/cancel`, {});
}

export async function declineConsultation(id: string) {
  return apiClient.patch<Consultation>(`/consultations/${id}/decline`, {});
}

export async function updateConsultation(id: string, data: { notes?: string; scheduled_at?: string }) {
  return apiClient.patch<Consultation>(`/consultations/${id}`, data);
}
