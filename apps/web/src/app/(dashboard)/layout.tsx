import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { Sidebar } from "@/shared/components/layout/Sidebar";
import { MobileNav } from "@/shared/components/layout/MobileNav";
import { NotificationBell } from "@/shared/components/layout/NotificationBell";
import type { UserRole } from "@/entities/types";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const role     = (user.app_metadata?.role ?? user.user_metadata?.role ?? "user") as UserRole;

  const fullName = user.user_metadata?.full_name ?? user.email ?? "User";

  return (
    <div className="flex h-screen overflow-hidden bg-base-100">
      <div className="fixed top-0 left-0 right-0 h-[2px] z-50 bg-gradient-to-r from-transparent via-brand-gold to-transparent" />
      <div className="hidden lg:flex lg:shrink-0 pt-[2px]">
        <Sidebar role={role} userName={fullName} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="relative z-40 flex items-center justify-between border-b border-brand-gold/12 bg-base-100/95 backdrop-blur px-4 py-3 lg:hidden">
          <span className="font-serif text-2xl font-bold">Le<span className="font-sans font-medium text-brand-gold">Ad</span></span>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-brand-gold/20 bg-brand-gold/8 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-gold">{role}</span>
            <NotificationBell />
            <MobileNav role={role} userName={fullName} />
          </div>
        </header>
        <main className="custom-scrollbar flex-1 overflow-y-auto px-5 py-7 md:px-8 md:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}
