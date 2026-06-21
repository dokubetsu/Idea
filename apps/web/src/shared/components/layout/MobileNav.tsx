"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Scale, LogOut } from "lucide-react";
import { createClient } from "@/shared/lib/supabase/client";
import type { UserRole } from "@/entities/types";
import { NAV, ROLE_COLOR, ROLE_LABEL } from "@/shared/lib/navigation";

export function MobileNav({ role, userName }: { role: UserRole; userName: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-gold/15 bg-brand-gold/8 text-brand-gold hover:bg-brand-gold/15"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-brand-blue-dark/50 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-brand-blue-dark p-6 text-brand-base-100 shadow-2xl transition-transform duration-300">
            <div className="absolute right-4 top-4">
              <button
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/50 hover:bg-white/5 hover:text-white"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>


            {/* Logo */}
            <div className="flex items-center gap-3 border-b border-white/8 pb-5 pt-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gold/15">
                <Scale className="h-4 w-4 text-brand-gold" />
              </div>
              <span className="font-serif text-2xl font-bold">LeAd</span>
            </div>

            {/* User Info */}
            <div className="border-b border-white/8 py-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/30">Signed in as</p>
              <p className="mt-0.5 truncate text-[13px] font-semibold text-brand-base-100">{userName}</p>
              <span className={`mt-1.5 inline-block rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] ${ROLE_COLOR[role]}`}>
                {ROLE_LABEL[role]}
              </span>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 space-y-1 overflow-y-auto py-6">
              {NAV[role]?.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-[13px] font-medium transition-all duration-200 ${
                      active ? "bg-white/8 text-brand-gold" : "text-white/50 hover:bg-white/5 hover:text-white/85"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Sign Out */}
            <div className="border-t border-white/8 pt-4">
              <button
                type="button"
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-[13px] font-medium text-white/40 transition-all hover:bg-white/5 hover:text-white/70"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
