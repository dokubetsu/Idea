"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BookOpen, Briefcase, Database, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/lib/supabase/client";
import { apiClient } from "@/shared/lib/api/client";
import { Spinner } from "@/shared/components/ui";
import { AdminStats } from "@/entities/types";

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoadingUser(false);
    });
  }, []);

  const { data: stats, isLoading: loadingStats } = useQuery<AdminStats>({
    queryKey: ["admin", "stats"],
    queryFn: () => apiClient.get<AdminStats>("/admin/stats"),
    enabled: !!user,
  });

  if (loadingUser || loadingStats) {
    return (
      <div className="flex justify-center items-center py-32">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const cards = [
    { label: "Users",          value: stats?.total_users ?? "—",           icon: Users,         color: "text-brand-accent",  bg: "border-brand-accent/20 bg-brand-accent/8" },
    { label: "Lawyers",        value: stats?.total_lawyers ?? "—",          icon: Briefcase,     color: "text-brand-teal",    bg: "border-brand-teal/20 bg-brand-teal/8" },
    { label: "Total matters",  value: stats?.total_matters ?? "—",          icon: BookOpen,      color: "text-brand-gold",    bg: "border-brand-gold/20 bg-brand-gold/8" },
    { label: "Total facts",    value: stats?.total_facts ?? "—",            icon: Database,      color: "text-brand-gold",    bg: "border-brand-gold/20 bg-brand-gold/8" },
    { label: "Pending verify", value: stats?.pending_verifications ?? "—",  icon: AlertTriangle, color: "text-red-500",       bg: "border-red-500/20 bg-red-500/8" },
    { label: "Open matters",   value: stats?.open_matters ?? "—",           icon: BookOpen,      color: "text-brand-accent",  bg: "border-brand-accent/20 bg-brand-accent/8" },
  ];

  return (
    <div className="animate-fade-in-up max-w-5xl space-y-9">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">Platform control</p>
        <h1 className="mt-1 font-serif text-5xl font-bold">Admin overview.</h1>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, color, bg }, i) => (
          <div key={label} style={{ animationDelay: `${(i + 1) * 0.06}s` }} className={`animate-fade-in-up rounded-xl border p-5 bg-base-100 ${bg.split(" ")[0]}`}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className={`mt-3 font-serif text-4xl font-bold ${color}`}>{value}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-blue-light/45">{label}</p>
          </div>
        ))}
      </div>
      {stats && stats.pending_verifications > 0 && (
        <div className="flex items-start gap-4 rounded-xl border border-red-400/20 bg-red-50 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div>
            <p className="font-semibold text-red-700">{stats.pending_verifications} lawyer{stats.pending_verifications > 1?"s":""} awaiting verification</p>
            <p className="mt-1 text-sm text-red-600/70">Review from the <Link href="/admin/lawyers" className="font-semibold underline">Lawyers</Link> tab.</p>
          </div>
        </div>
      )}
    </div>
  );
}
