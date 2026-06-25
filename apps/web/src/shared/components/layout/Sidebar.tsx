"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { LogOut, Scale } from "lucide-react";
import { createClient } from "@/shared/lib/supabase/client";
import type { UserRole } from "@/entities/types";
import { NAV, ROLE_COLOR, ROLE_LABEL } from "@/shared/lib/navigation";
import { NotificationBell } from "./NotificationBell";
import { useFeatures } from "@/shared/hooks/useFeatures";


export function Sidebar({ role, userName }: { role: UserRole; userName: string }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { features } = useFeatures();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r border-brand-gold/12 bg-brand-blue-dark text-brand-base-100">
      {/* Logo & Bell */}
      <div className="flex items-center justify-between border-b border-white/8 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gold/15">
            <Scale className="h-4 w-4 animate-scale-tilt text-brand-gold" />
          </div>
          <span className="font-serif text-2xl font-bold">Le<span className="font-sans text-brand-gold">Ad</span></span>
        </div>
        <NotificationBell />
      </div>

      {/* User info */}
      <div className="border-b border-white/8 px-5 py-4">
        <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/30">Signed in as</p>
        <p className="mt-0.5 truncate text-[13px] font-semibold text-brand-base-100">{userName}</p>
        <span className={`mt-1.5 inline-block rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] ${ROLE_COLOR[role]}`}>
          {ROLE_LABEL[role]}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV[role]?.filter(({ href }) => {
          if (href.includes("lawyers") && !features.consultations) return false;
          return true;
        }).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                active ? "bg-white/8 text-brand-gold" : "text-white/50 hover:bg-white/5 hover:text-white/85"}`}>
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-brand-gold" : ""}`} />
              {label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-gold" />}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="border-t border-white/8 p-3">
        <button type="button" onClick={signOut}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium text-white/40 transition-all hover:bg-white/5 hover:text-white/70">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
