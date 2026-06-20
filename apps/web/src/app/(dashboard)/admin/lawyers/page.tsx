"use client";
import { useEffect, useState } from "react";
import { CheckCircle, ShieldOff } from "lucide-react";
import { apiClient } from "@/shared/lib/api/client";
export default function AdminLawyersPage() {
  const [lawyers, setLawyers] = useState<Record<string,unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState<string|null>(null);
  useEffect(() => { apiClient.get<Record<string,unknown>[]>("/admin/lawyers/pending").then(setLawyers).finally(()=>setLoading(false)); }, []);
  async function verify(id: string) {
    setActing(id);
    try {
      await apiClient.patch(`/admin/lawyers/${id}/verify`, {});
      setLawyers(p => p.filter(l => l.id !== id));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to verify lawyer.";
      alert(errMsg);
    } finally {
      setActing(null);
    }
  }

  async function suspend(id: string) {
    setActing(id);
    try {
      await apiClient.patch(`/admin/lawyers/${id}/suspend`, {});
      setLawyers(p => p.filter(l => l.id !== id));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to reject lawyer.";
      alert(errMsg);
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="animate-fade-in-up space-y-7">
      <div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">Lawyer management</p><h1 className="mt-1 font-serif text-4xl font-bold">Pending verifications.</h1></div>
      {loading ? <Loader /> : lawyers.length===0 ? <p className="py-16 text-center text-sm text-brand-blue-light/40">All lawyers verified ✓</p> : (
        <div className="grid gap-5 lg:grid-cols-2">
          {lawyers.map(l => {
            const id = String(l.id);
            const p = (l.profiles as Record<string,string>)||({}as Record<string,string>);
            return (
              <div key={id} className="overflow-hidden rounded-xl border border-brand-gold/12 bg-base-100">
                <div className="h-1 bg-gradient-to-r from-brand-gold to-brand-gold-light" />
                <div className="p-5">
                  <p className="font-serif text-xl font-bold">{p.full_name??"—"}</p>
                  <p className="text-xs text-brand-blue-light/50">{p.city??""} · Joined {p.created_at ? new Date(p.created_at).toLocaleDateString("en-IN"):"—"}</p>
                  <div className="mt-3 space-y-1 text-sm text-brand-blue-light/65">
                    <p><span className="font-semibold">Bar ID:</span> {String(l.bar_council_id??"Not provided")}</p>
                    <p><span className="font-semibold">State:</span> {String(l.enrollment_state??"—")}</p>
                    <p><span className="font-semibold">Experience:</span> {String(l.experience_years??0)} yrs</p>
                    <p><span className="font-semibold">Specializations:</span> {((l.specializations as string[])||[]).join(", ")||"—"}</p>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button type="button" disabled={acting===id} onClick={()=>verify(id)}
                      className="shimmer-btn flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-2 text-xs font-semibold text-brand-blue-dark hover:bg-brand-gold-light disabled:opacity-50">
                      {acting===id ? <Spin/> : <CheckCircle className="h-3.5 w-3.5"/>} Verify & approve
                    </button>
                    <button type="button" disabled={acting===id} onClick={()=>suspend(id)}
                      className="flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-50 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50">
                      <ShieldOff className="h-3.5 w-3.5"/> Reject
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
function Loader() { return <div className="flex justify-center py-16"><div className="h-8 w-8 rounded-full border-2 border-brand-gold/25 border-t-brand-gold animate-spin"/></div>; }
function Spin() { return <span className="h-3.5 w-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin"/>; }
