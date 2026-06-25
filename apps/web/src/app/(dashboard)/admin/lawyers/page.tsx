"use client";

import { CheckCircle, ShieldOff } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api/client";
import { useToast } from "@/shared/components/ui";
import { PendingLawyer } from "@/entities/types";
import { Spinner } from "@/shared/components/ui";

export default function AdminLawyersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: lawyers = [], isLoading } = useQuery<PendingLawyer[]>({
    queryKey: ["admin", "pending-lawyers"],
    queryFn: () => apiClient.get<PendingLawyer[]>("/admin/lawyers/pending"),
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/admin/lawyers/${id}/verify`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Advocate approved and verified successfully.");
    },
    onError: (err: any) => {
      const errMsg = err?.message || "Failed to verify lawyer.";
      toast.error(errMsg);
    },
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/admin/lawyers/${id}/suspend`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Advocate application rejected successfully.");
    },
    onError: (err: any) => {
      const errMsg = err?.message || "Failed to reject lawyer.";
      toast.error(errMsg);
    },
  });

  const verify = (id: string) => verifyMutation.mutate(id);
  const suspend = (id: string) => suspendMutation.mutate(id);

  const acting = verifyMutation.isPending || suspendMutation.isPending;
  const actingId = verifyMutation.isPending ? verifyMutation.variables : suspendMutation.variables;

  return (
    <div className="animate-fade-in-up space-y-7">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">Lawyer management</p>
        <h1 className="mt-1 font-serif text-4xl font-bold">Pending verifications.</h1>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : lawyers.length === 0 ? (
        <p className="py-16 text-center text-sm text-brand-blue-light/40">All lawyers verified ✓</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {lawyers.map((l) => {
            const id = l.id;
            const p = l.profiles || { full_name: "", city: "", state: "", phone: "", created_at: "" };
            const isActingThis = acting && actingId === id;
            return (
              <div key={id} className="overflow-hidden rounded-xl border border-brand-gold/12 bg-base-100">
                <div className="h-1 bg-gradient-to-r from-brand-gold to-brand-gold-light" />
                <div className="p-5">
                  <p className="font-serif text-xl font-bold">{p.full_name || "—"}</p>
                  <p className="text-xs text-brand-blue-light/50">
                    {p.city || ""} · Joined {p.created_at ? new Date(p.created_at).toLocaleDateString("en-IN") : "—"}
                  </p>
                  <div className="mt-3 space-y-1 text-sm text-brand-blue-light/65">
                    <p><span className="font-semibold">Bar ID:</span> {l.bar_council_id || "Not provided"}</p>
                    <p><span className="font-semibold">State:</span> {l.enrollment_state || "—"}</p>
                    <p><span className="font-semibold">Experience:</span> {l.experience_years ?? 0} yrs</p>
                    <p><span className="font-semibold">Specializations:</span> {l.specializations?.join(", ") || "—"}</p>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => verify(id)}
                      className="shimmer-btn flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-2 text-xs font-semibold text-brand-blue-dark hover:bg-brand-gold-light disabled:opacity-50"
                    >
                      {isActingThis ? <span className="h-3.5 w-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />} Verify & approve
                    </button>
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => suspend(id)}
                      className="flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-50 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      <ShieldOff className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
