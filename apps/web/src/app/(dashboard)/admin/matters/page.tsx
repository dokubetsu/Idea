"use client";
import { useEffect, useState } from "react";
import { apiClient } from "@/shared/lib/api/client";
const STATUS_DOT: Record<string,string> = { active:"bg-brand-teal", intake:"bg-brand-gold", assessment:"bg-brand-accent", matching:"bg-brand-accent", resolved:"bg-base-300", archived:"bg-base-300" };
export default function AdminMattersPage() {
  const [matters, setMatters] = useState<Record<string,unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState("");
  useEffect(()=>{setLoading(true);apiClient.get<Record<string,unknown>[]>(`/admin/matters${status?`?status=${status}`:""}`).then(setMatters).finally(()=>setLoading(false));},[status]);
  return (
    <div className="animate-fade-in-up space-y-7">
      <div className="flex items-end justify-between gap-4">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">All matters</p><h1 className="mt-1 font-serif text-4xl font-bold">Platform matters.</h1></div>
        <select value={status} onChange={e=>setStatus(e.target.value)} className="min-h-10 rounded-xl border border-brand-gold/15 bg-base-100 px-3.5 text-sm outline-none focus:border-brand-gold">
          <option value="">All statuses</option>
          {["draft","intake","assessment","matching","active","resolved","archived"].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {loading ? <div className="flex justify-center py-10"><div className="h-8 w-8 rounded-full border-2 border-brand-gold/25 border-t-brand-gold animate-spin"/></div>
      : (
        <div className="overflow-hidden rounded-xl border border-brand-gold/12 bg-base-100">
          <table className="w-full text-sm">
            <thead className="border-b border-brand-gold/10 bg-base-200/50">
              <tr>{["Title","User","Lawyer","Category","Status","Created"].map(h=><th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue-light/45">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-brand-gold/8">
              {matters.map(m=>{
                const up = m.up as Record<string,string>|undefined;
                const lp = m.lp as Record<string,string>|undefined;
                const status = String(m.status??"");
                return (
                  <tr key={String(m.id)} className="hover:bg-base-200/30 transition-colors">
                    <td className="px-4 py-3 font-semibold max-w-[200px] truncate">{String(m.title??"—")}</td>
                    <td className="px-4 py-3 text-brand-blue-light/60">{up?.full_name??"—"}</td>
                    <td className="px-4 py-3 text-brand-blue-light/60">{lp?.full_name??"Unassigned"}</td>
                    <td className="px-4 py-3 text-brand-blue-light/60">{String(m.category??"").replace("_"," ")}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]??"bg-base-300"}`}/>
                        {status.replace("_"," ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brand-blue-light/50">{m.created_at?new Date(String(m.created_at)).toLocaleDateString("en-IN"):"—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
