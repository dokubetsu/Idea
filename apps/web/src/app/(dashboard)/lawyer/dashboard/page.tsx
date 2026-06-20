import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, Users } from "lucide-react";
import { createClient } from "@/shared/lib/supabase/server";
import { QuickStartGuide } from "@/shared/components/ui";
export const metadata = { title: "Lawyer Dashboard" };
export default async function LawyerDashboard() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const name = (user.user_metadata?.full_name ?? "Advocate").split(" ")[0];
  return (
    <>
      <QuickStartGuide />
      <div className="animate-fade-in-up max-w-7xl mx-auto space-y-9">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">Advocate workspace</p>
        <h1 className="mt-1 font-serif text-5xl font-bold">Welcome, {name}.</h1>
        <p className="mt-2 text-sm text-brand-blue-light/55">Manage assigned matters and client requests.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Link href="/lawyer/matters" className="group flex flex-col gap-3 rounded-xl border border-brand-gold/12 bg-base-100 p-6 transition-all hover:border-brand-gold/25 hover:shadow-md hover:-translate-y-0.5">
          <BookOpen className="h-6 w-6 text-brand-gold" />
          <div>
            <p className="font-serif text-xl font-bold">Assigned matters</p>
            <p className="mt-1 text-sm text-brand-blue-light/55">View facts, post updates, manage timelines.</p>
          </div>
        </Link>
        <Link href="/lawyer/clients" className="group flex flex-col gap-3 rounded-xl border border-brand-gold/12 bg-base-100 p-6 transition-all hover:border-brand-gold/25 hover:shadow-md hover:-translate-y-0.5">
          <Users className="h-6 w-6 text-brand-teal" />
          <div>
            <p className="font-serif text-xl font-bold">Client requests</p>
            <p className="mt-1 text-sm text-brand-blue-light/55">Accept or decline incoming contact requests.</p>
          </div>
        </Link>
      </div>
      <div className="rounded-xl border border-brand-gold/12 bg-base-100 p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold mb-3">Your value as a lawyer on this platform</p>
        <p className="text-sm leading-7 text-brand-blue-light/65">
          Each matter you receive includes AI-extracted facts and an initial legal assessment. Your job is to verify those facts,
          correct what needs correcting, and drive the matter to resolution — not to start from scratch.
        </p>
      </div>
      </div>
    </>
  );
}
