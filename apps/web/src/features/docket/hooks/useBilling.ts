import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/shared/components/ui/Toast";
import { docketKeys } from "./useLawyerDashboard";
import { getCaseBilling, createInvoice, updateInvoice } from "../api/billing";

export function useCaseBilling(matterId: string) {
  return useQuery({
    queryKey: docketKeys.billing(matterId),
    queryFn: () => getCaseBilling(matterId),
    enabled: !!matterId,
  });
}

export function useCreateInvoice(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (data: { time_entry_ids: string[]; disbursement_ids?: string[]; work_summary?: string; due_date?: string }) =>
      createInvoice(matterId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: docketKeys.billing(matterId) });
      qc.invalidateQueries({ queryKey: docketKeys.overview(matterId) });
      toast.success("Invoice created");
    },
    onError: (err: any) => toast.error(err.detail || err.message || "Failed to create invoice"),
  });
}

export function useUpdateInvoice(matterId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ invoiceId, ...data }: { invoiceId: string; status?: string }) =>
      updateInvoice(matterId, invoiceId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: docketKeys.billing(matterId) });
      toast.success("Invoice updated");
    },
    onError: (err: any) => toast.error(err.detail || err.message || "Failed to update invoice"),
  });
}
