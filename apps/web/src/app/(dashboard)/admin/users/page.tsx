"use client";
import { useEffect, useState } from "react";
import { ShieldOff } from "lucide-react";
import { apiClient } from "@/shared/lib/api/client";
import type { Profile } from "@/entities/types";
export default function AdminUsersPage() {
  const [users, setUsers]   = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("user");
  useEffect(() => { setLoading(true); apiClient.get<Profile[]>(`/admin/users?role=${filter}`).then(setUsers).finally(()=>setLoading(false)); }, [filter]);
  return (
    <div className="animate-fade-in-up space-y-7">
      <div className="flex items-end justify-between">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">User management</p><h1 className="mt-1 font-serif text-4xl font-bold">All users.</h1></div>
        <div className="flex gap-1.5 rounded-xl border border-brand-gold/15 bg-base-200/60 p-1.5">
          {["user","lawyer","admin"].map(r=>(
            <button key={r} type="button" onClick={()=>setFilter(r)}
              className={`rounded-xl px-3.5 py-1.5 text-[11px] font-semibold capitalize transition-all ${filter===r?"bg-brand-blue-dark text-brand-gold shadow-sm":"text-brand-blue-light/60 hover:text-brand-blue-dark"}`}>
              {r}s
            </button>
          ))}
        </div>
      </div>
      {loading ? <div className="flex justify-center py-16"><div className="h-8 w-8 rounded-full border-2 border-brand-gold/25 border-t-brand-gold animate-spin"/></div>
      : users.length===0 ? <p className="py-16 text-center text-sm text-brand-blue-light/40">No users found.</p>
      : (
        <div className="overflow-hidden rounded-xl border border-brand-gold/12 bg-base-100">
          <table className="w-full text-sm">
            <thead className="border-b border-brand-gold/10 bg-base-200/50">
              <tr>{["Name","Location","Joined","Status",""].map(h=><th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue-light/45">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-brand-gold/8">
              {users.map(u=>(
                <tr key={u.id} className="hover:bg-base-200/30 transition-colors">
                  <td className="px-4 py-3 font-semibold">{u.full_name}</td>
                  <td className="px-4 py-3 text-brand-blue-light/60">{[u.city,u.state].filter(Boolean).join(", ")||"—"}</td>
                  <td className="px-4 py-3 text-brand-blue-light/50">{new Date(u.created_at).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${u.is_active?"border-brand-teal/25 text-brand-teal":"border-red-400/20 text-red-500"}`}>
                      {u.is_active?"Active":"Suspended"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.is_active && <button type="button" onClick={()=>apiClient.patch(`/admin/users/${u.id}/suspend`,{}).then(()=>setUsers(p=>p.filter(x=>x.id!==u.id)))}
                      className="rounded-lg p-1.5 hover:bg-red-50 text-red-400 transition-colors"><ShieldOff className="h-3.5 w-3.5"/></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
