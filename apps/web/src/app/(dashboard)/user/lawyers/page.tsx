"use client";
import { useState } from "react";
import { CheckCircle, MapPin, Send, Shield } from "lucide-react";
import { useLawyers } from "@/features/matching/hooks/useLawyers";
import { useCreateConsultation } from "@/features/consultations/hooks/useConsultations";
import type { LawyerProfile } from "@/entities/types";

export default function FindLawyersPage() {
  const [city, setCity]   = useState("");
  const [spec, setSpec]   = useState("");
  const [filters, setFilters] = useState<{ city?: string; specialization?: string }>({});
  const { data: lawyers = [], isLoading } = useLawyers(filters);
  const createConsultation = useCreateConsultation();
  const [contacted, setContacted] = useState<Set<string>>(new Set());

  function search() { setFilters({ city: city || undefined, specialization: spec || undefined }); }

  async function contact(id: string) {
    await createConsultation.mutateAsync({ lawyer_id: id, package: "free" });
    setContacted(prev => new Set(prev).add(id));
  }

  return (
    <div className="animate-fade-in-up space-y-7">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">Legal Advisors</p>
        <h1 className="mt-1 font-serif text-4xl font-bold">Find a Legal Advisor</h1>
        <p className="mt-1.5 text-sm text-brand-blue-light/55">
          Browse verified lawyers by city and area of law. First consultation is free.
        </p>
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-brand-gold/12 bg-base-100 p-4 sm:flex-row">
        <input value={city} onChange={e=>setCity(e.target.value)} placeholder="City (e.g. Mumbai)"
          className="flex-1 min-h-10 rounded-xl border border-brand-gold/15 bg-base-200/50 px-3.5 text-sm outline-none focus:border-brand-gold" />
        <select value={spec} onChange={e=>setSpec(e.target.value)}
          className="flex-1 min-h-10 rounded-xl border border-brand-gold/15 bg-base-200/50 px-3.5 text-sm outline-none focus:border-brand-gold">
          <option value="">All areas of law</option>
          {["Consumer","Cheque Bounce","Property","Family","Labour","Criminal","Cyber","RERA"].map(s=>(
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button type="button" onClick={search}
          className="min-h-10 rounded-xl bg-brand-blue-dark px-5 text-sm font-semibold text-brand-gold hover:bg-brand-blue-light transition-colors">
          Search
        </button>
      </div>
      {isLoading ? <Loader /> : lawyers.length === 0 ? <Empty /> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {lawyers.map(l => (
            <LawyerCard key={l.id} lawyer={l}
              contacted={contacted.has(l.id)}
              onContact={() => contact(l.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function LawyerCard({ lawyer: l, contacted, onContact }: { lawyer: LawyerProfile; contacted: boolean; onContact: () => void }) {
  const initials = (l.full_name ?? "?").charAt(0).toUpperCase();

  return (
    <div className="overflow-hidden rounded-xl border border-brand-gold/12 bg-base-100 transition-all hover:shadow-md hover:-translate-y-0.5">
      <div className="h-1 bg-gradient-to-r from-brand-gold to-brand-gold-light" />
      <div className="p-5">
        <div className="flex items-start gap-3">
          {/* Photo / Avatar */}
          <div className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden border border-brand-gold/20">
            {(l as LawyerProfile & { avatar_url?: string }).avatar_url ? (
              <img
                src={(l as LawyerProfile & { avatar_url?: string }).avatar_url}
                alt={l.full_name ?? "Lawyer"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-brand-blue-dark font-serif text-xl font-bold text-brand-gold">
                {initials}
              </div>
            )}
            {l.is_verified && (
              <span className="absolute bottom-0.5 right-0.5 rounded-full bg-brand-teal p-0.5 shadow">
                <CheckCircle className="h-3 w-3 text-white" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="font-serif text-lg font-bold leading-tight truncate">{l.full_name}</p>
            </div>
            <p className="flex items-center gap-1 text-xs text-brand-blue-light/50 mt-0.5">
              <MapPin className="h-3 w-3" />{l.city}, {l.state}
            </p>
            {l.experience_years != null && (
              <p className="text-xs text-brand-blue-light/40 mt-0.5">
                {l.experience_years} yr{l.experience_years !== 1 ? "s" : ""} experience
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {l.specializations.slice(0,3).map(s => (
            <span key={s} className="rounded-full border border-brand-gold/20 bg-brand-gold/8 px-2.5 py-0.5 text-[10px] font-semibold text-brand-gold">{s}</span>
          ))}
        </div>
        {l.bio && <p className="mt-3 text-xs leading-5 text-brand-blue-light/60 line-clamp-2">{l.bio}</p>}

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {l.is_verified ? (
              <>
                <Shield className="h-3.5 w-3.5 text-brand-teal" />
                <span className="text-[10px] font-semibold text-brand-teal">Bar Council Verified</span>
              </>
            ) : (
              <span className="text-[10px] text-brand-blue-light/30">Verification pending</span>
            )}
          </div>
          <span className={`text-[10px] font-semibold ${l.is_available ? "text-brand-teal" : "text-brand-blue-light/35"}`}>
            {l.is_available ? "● Available" : "● Busy"}
          </span>
        </div>
      </div>
      <div className="border-t border-brand-gold/10 p-4">
        {(!l.offers_free_consultation && (!l.offered_packages || l.offered_packages.length === 0)) ? (
          <div className="flex w-full items-center justify-center rounded-xl bg-base-200 px-4 py-2 text-[11px] font-semibold text-brand-blue-light/40">
            Not currently accepting consultations
          </div>
        ) : (
          <button type="button" onClick={onContact} disabled={contacted || !l.is_available}
            className={`shimmer-btn flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-[11px] font-semibold transition-all ${
              contacted ? "border border-brand-teal/25 bg-brand-teal/10 text-brand-teal" :
              "bg-brand-gold text-brand-blue-dark hover:bg-brand-gold-light"} disabled:opacity-50`}>
            {contacted ? <><CheckCircle className="h-3.5 w-3.5" />Request sent</> : <><Send className="h-3.5 w-3.5" />Book free consultation</>}
          </button>
        )}
      </div>
    </div>
  );
}

function Loader() { return <div className="flex justify-center py-16"><div className="h-8 w-8 rounded-full border-2 border-brand-gold/25 border-t-brand-gold animate-spin" /></div>; }
function Empty() { return <div className="py-16 text-center text-sm text-brand-blue-light/40">No lawyers found. Try adjusting filters.</div>; }
