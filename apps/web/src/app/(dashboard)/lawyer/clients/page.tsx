"use client";
import { CheckCircle, X, ExternalLink } from "lucide-react";
import { useConsultations, useConfirmConsultation, useDeclineConsultation } from "@/features/consultations/hooks/useConsultations";
import Link from "next/link";

export default function LawyerClientsPage() {
  const { data: consultations = [], isLoading } = useConsultations();
  const confirm = useConfirmConsultation();
  const decline = useDeclineConsultation();

  return (
    <div className="animate-fade-in-up space-y-7">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">Client requests</p>
        <h1 className="mt-1 font-serif text-4xl font-bold">Consultation requests.</h1>
      </div>
      {isLoading ? <div className="flex justify-center py-16"><div className="h-8 w-8 rounded-full border-2 border-brand-gold/25 border-t-brand-gold animate-spin" /></div>
      : consultations.length === 0 ? <p className="py-16 text-center text-sm text-brand-blue-light/40">No requests yet.</p>
      : (
        <div className="grid gap-5 lg:grid-cols-2">
          {consultations.map((c) => (
            <div key={c.id} className="rounded-xl border border-brand-gold/12 bg-base-100 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-brand-gold to-brand-gold-light" />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-serif text-xl font-bold">{c.user_name ?? "User"}</p>
                    <p className="text-xs text-brand-blue-light/50">Requested {new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                    c.status === "confirmed" || c.status === "completed" ? "border-brand-teal/25 bg-brand-teal/10 text-brand-teal" : 
                    c.status === "declined" || c.status === "cancelled" ? "border-red-400/20 bg-red-50 text-red-500" : 
                    "border-brand-gold/25 bg-brand-gold/10 text-brand-gold"
                  }`}>
                    {c.status}
                  </span>
                </div>
                
                <div className="mt-3 rounded-xl border border-brand-gold/12 bg-brand-gold/5 p-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-brand-gold/70">Consultation Package</p>
                  <p className="mt-1 text-sm font-semibold capitalize">{c.package} ({c.sessions_total} Session{c.sessions_total > 1 ? 's' : ''})</p>
                </div>
                
                {!!c.notes && <p className="mt-3 text-sm leading-6 text-brand-blue-light/65">"{c.notes}"</p>}
                
                {c.status === "pending" && (
                  <div className="mt-4 flex gap-3">
                    <button type="button" onClick={() => confirm.mutate(c.id)} disabled={confirm.isPending || decline.isPending}
                      className="shimmer-btn flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-2 text-xs font-semibold text-brand-blue-dark hover:bg-brand-gold-light disabled:opacity-50">
                      <CheckCircle className="h-3.5 w-3.5" /> Accept
                    </button>
                    <button type="button" onClick={() => decline.mutate(c.id)} disabled={confirm.isPending || decline.isPending}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-base-300 px-4 py-2 text-xs font-medium text-brand-blue-light/60 hover:bg-base-200 transition-colors disabled:opacity-50">
                      <X className="h-3.5 w-3.5" /> Decline
                    </button>
                  </div>
                )}
                
                {c.matter_id && (
                  <div className="mt-4">
                    <Link href={`/lawyer/matters/${c.matter_id}`} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-blue-dark px-4 py-2.5 text-xs font-semibold text-brand-gold hover:bg-brand-blue-light transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" /> View Case File
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
