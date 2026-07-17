import { apiClient } from "@/shared/lib/api/client";
import type { LawyerBilling, ClientBilling, FeeArrangement, TimeEntry, Invoice, Disbursement } from "../types";

export const getCaseBilling = (matterId: string) =>
  apiClient.get<LawyerBilling | ClientBilling>(`/docket/matters/${matterId}/billing`);

export const createTimeEntry = (matterId: string, data: { activity: string; hours: number; rate_per_hour?: number }) =>
  apiClient.post<TimeEntry>(`/docket/matters/${matterId}/time-entries`, data);

export const createInvoice = (matterId: string, data: { time_entry_ids: string[]; disbursement_ids?: string[]; work_summary?: string; due_date?: string }) =>
  apiClient.post<Invoice>(`/docket/matters/${matterId}/invoices`, data);

export const updateInvoice = (matterId: string, invoiceId: string, data: { status?: string }) =>
  apiClient.patch<Invoice>(`/docket/matters/${matterId}/invoices/${invoiceId}`, data);

export const getFeeArrangement = (matterId: string) =>
  apiClient.get<FeeArrangement | null>(`/docket/matters/${matterId}/fee-arrangement`);

export const getDisbursements = (matterId: string) =>
  apiClient.get<Disbursement[]>(`/docket/matters/${matterId}/disbursements`);
