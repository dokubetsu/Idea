import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, ChevronRight, Plus, Users } from "lucide-react";
import { createClient } from "@/shared/lib/supabase/server";
import { QuickStartGuide } from "@/shared/components/ui";
export const metadata = { title: "Dashboard" };

const HEALTH_DOT: Record<string, string> = {
  waiting_on_client: "bg-amber-400",
  waiting_on_lawyer: "bg-blue-400",
  waiting_on_court:  "bg-slate-400",
  in_progress:       "bg-brand-teal",
};
const HEALTH_LABEL: Record<string, string> = {
  waiting_on_client: "Waiting on you",
  waiting_on_lawyer: "Waiting on lawyer",
  waiting_on_court:  "Waiting on court",
  in_progress:       "In progress",
};
const STATUS_LABEL: Record<string, string> = {
  intake: "Setting up", assessment: "Being reviewed",
  matching: "Finding a lawyer", active: "Active",
  resolved: "Resolved", archived: "Archived", draft: "Draft",
};

export default async function UserDashboard() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const name = (user.user_metadata?.full_name ?? "there").split(" ")[0];

  // Fetch up to 3 most recent active cases for the widget
  const { data: recentCasesRaw } = await sb
    .from("matters")
    .select("id, title, status, case_health, updated_at, category")
    .not("status", "in", '("resolved","archived")')
    .order("updated_at", { ascending: false })
    .limit(3);
  const recentCases = recentCasesRaw ?? [];

  // Fetch pending consultations
  const { data: pendingConsultationsRaw } = await sb
    .from("consultations")
    .select("id, lawyer_id, lp:profiles!lawyer_id(full_name), package, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  const pendingConsultations = pendingConsultationsRaw ?? [];

  return (
    <>
      <QuickStartGuide />
      <div className="animate-fade-in-up max-w-7xl mx-auto space-y-9">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">Welcome back</p>
        <h1 className="mt-1 font-serif text-5xl font-bold">Hello, {name}.</h1>
        <p className="mt-2 text-sm text-brand-blue-light/55">What would you like to do today?</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { href: "/user/matters", icon: Plus, label: "Tell us about your case", desc: "Describe what happened and get a free AI assessment" },
          { href: "/user/lawyers", icon: Users, label: "Find a legal advisor", desc: "Browse verified lawyers by city and area of law" },
          { href: "/user/matters", icon: BookOpen, label: "My cases", desc: "Track your case progress, hearings, and messages" },
        ].map(({ href, icon: Icon, label, desc }, i) => (
          <Link key={label} href={href}
            className={`animate-fade-in-up animate-stagger-${i+1} group flex flex-col gap-3 rounded-xl border border-brand-gold/12 bg-base-100 p-6 transition-all hover:border-brand-gold/25 hover:shadow-md hover:-translate-y-0.5`}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-gold/15 bg-brand-gold/8 text-brand-gold group-hover:bg-brand-gold/15 transition-colors">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-serif text-lg font-bold">{label}</p>
              <p className="mt-1 text-xs leading-5 text-brand-blue-light/55">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Cases Widget */}
      {recentCases.length > 0 && (
        <div className="rounded-xl border border-brand-gold/12 bg-base-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-brand-gold/8">
            <p className="font-serif text-lg font-bold">Your Active Cases</p>
            <Link href="/user/matters" className="text-xs font-semibold text-brand-gold hover:text-brand-gold-light">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-brand-gold/6">
            {recentCases.map((c: {
              id: string; title: string; status: string;
              case_health?: string; updated_at?: string; category: string;
            }) => {
              const health = c.case_health ?? "in_progress";
              const daysAgo = c.updated_at
                ? Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000)
                : null;
              const timeLabel = daysAgo === null ? "" : daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo} days ago`;
              return (
                <Link key={c.id} href={`/user/matters/${c.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 transition-all hover:bg-brand-gold/4 group">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${HEALTH_DOT[health] ?? "bg-brand-teal"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{c.title}</p>
                    <p className="text-[11px] text-brand-blue-light/45">
                      {HEALTH_LABEL[health] ?? "In progress"}
                      {timeLabel ? ` · ${timeLabel}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-brand-blue-light/20 group-hover:text-brand-gold transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending Consultations Widget */}
      {pendingConsultations.length > 0 && (
        <div className="rounded-xl border border-brand-gold/12 bg-base-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-brand-gold/8">
            <p className="font-serif text-lg font-bold">Pending Consultations</p>
            <p className="text-xs text-brand-blue-light/50 mt-1">Waiting for the lawyer to confirm</p>
          </div>
          <div className="divide-y divide-brand-gold/6">
            {pendingConsultations.map((c: any) => {
              const lawyerName = c.lp?.full_name ?? "Platform Assigned Lawyer";
              return (
                <div key={c.id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-semibold truncate">{lawyerName}</p>
                    <p className="text-[11px] text-brand-blue-light/45 capitalize">
                      {c.package} Package • Requested on {new Date(c.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-1 text-[10px] font-semibold text-brand-gold uppercase tracking-wider">
                    Pending
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grain relative overflow-hidden rounded-2xl bg-brand-blue-dark p-8 text-brand-base-100">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-brand-gold/8 blur-2xl" />
        <div className="relative z-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold mb-3">How LeAd works</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { n: "01", t: "Describe", d: "Tell us what happened — no legal jargon needed" },
              { n: "02", t: "AI reviews your case", d: "Key facts extracted — dates, amounts, and parties" },
              { n: "03", t: "Get expert guidance", d: "Risk assessment, timeline, and a matched lawyer" },
            ].map(({ n, t, d }) => (
              <div key={n}>
                <p className="font-serif text-3xl font-bold text-brand-gold/40">{n}</p>
                <p className="mt-1 font-semibold text-brand-base-100">{t}</p>
                <p className="mt-1 text-xs leading-5 text-brand-base-200/55">{d}</p>
              </div>
            ))}
          </div>
          <Link href="/user/matters"
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-brand-gold/30 bg-brand-gold/15 px-4 py-2 text-sm font-semibold text-brand-gold transition-all hover:bg-brand-gold/25">
            Tell us about your case <Plus className="h-4 w-4" />
          </Link>
        </div>
      </div>
      </div>
    </>
  );
}
