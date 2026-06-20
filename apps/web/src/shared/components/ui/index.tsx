"use client";
import { type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Button({ children, onClick, variant = "primary", size = "md", disabled, type = "button", className }: {
  children: ReactNode; onClick?: () => void;
  variant?: "primary"|"secondary"|"gold"|"danger"|"ghost";
  size?: "sm"|"md"|"lg"; disabled?: boolean; type?: "button"|"submit"; className?: string;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={cn(
        "shimmer-btn inline-flex items-center justify-center gap-2 font-semibold rounded-xl border transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" && "px-3.5 py-1.5 text-[11px] min-h-8",
        size === "md" && "px-5 py-2.5 text-sm min-h-10",
        size === "lg" && "px-6 py-3 text-[15px] min-h-12",
        variant === "primary"   && "bg-brand-blue-dark border-brand-gold/30 text-brand-gold hover:bg-brand-blue-light hover:border-brand-gold/50 shadow-sm hover:shadow-md",
        variant === "secondary" && "bg-base-100 border-brand-gold/15 text-brand-blue-dark hover:bg-base-200 hover:border-brand-gold/30",
        variant === "gold"      && "bg-brand-gold border-brand-gold text-brand-blue-dark hover:bg-brand-gold-light shadow-sm hover:shadow-md",
        variant === "danger"    && "bg-red-600 border-red-600 text-white hover:bg-red-700",
        variant === "ghost"     && "bg-transparent border-transparent text-brand-blue-light/60 hover:bg-base-200 hover:text-brand-blue-dark",
        className,
      )}>
      {children}
    </button>
  );
}

export function Badge({ children, tone = "gold", className }: { children: ReactNode; tone?: "gold"|"teal"|"blue"|"red"|"muted"; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
      tone === "gold"  && "border-brand-gold/25 bg-brand-gold/10 text-brand-gold",
      tone === "teal"  && "border-brand-teal/25 bg-brand-teal/10 text-brand-teal",
      tone === "blue"  && "border-brand-accent/25 bg-brand-accent/10 text-brand-accent",
      tone === "red"   && "border-red-500/20 bg-red-50 text-red-600",
      tone === "muted" && "border-black/10 bg-black/5 text-brand-blue-light/50",
      className,
    )}>{children}</span>
  );
}

export function Card({ children, className, hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-brand-gold/12 bg-base-100 shadow-sm",
      hover && "transition-all duration-200 hover:border-brand-gold/25 hover:shadow-md hover:-translate-y-0.5",
      className)}>{children}</div>
  );
}

export function DarkCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grain relative overflow-hidden rounded-xl border border-white/8 bg-brand-blue-dark text-brand-base-100 shadow-xl", className)}>{children}</div>;
}

export function Input({ label, error, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue-light/50">{label}</span>}
      <input className={cn("min-h-11 w-full rounded-xl border px-3.5 text-[13px] text-brand-blue-dark outline-none transition-all duration-200 placeholder:text-brand-blue-light/30 focus:shadow-sm",
        error ? "border-red-400 bg-red-50" : "border-brand-gold/15 bg-base-100 focus:border-brand-gold focus:bg-white", className)} {...props} />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </label>
  );
}

export function Textarea({ label, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue-light/50">{label}</span>}
      <textarea rows={4} className={cn("w-full rounded-xl border border-brand-gold/15 bg-base-100 px-3.5 py-3 text-[13px] text-brand-blue-dark outline-none transition-all duration-200 placeholder:text-brand-blue-light/30 focus:border-brand-gold focus:bg-white focus:shadow-sm resize-none", className)} {...props} />
    </label>
  );
}

export function Select({ label, children, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue-light/50">{label}</span>}
      <select className={cn("min-h-11 w-full rounded-xl border border-brand-gold/15 bg-base-100 px-3.5 text-[13px] text-brand-blue-dark outline-none transition-all duration-200 focus:border-brand-gold focus:shadow-sm", className)} {...props}>{children}</select>
    </label>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <div className={cn("rounded-full border-2 border-brand-gold/25 border-t-brand-gold animate-spin", className ?? "h-5 w-5")} />;
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: React.ElementType; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="animate-float rounded-2xl border border-brand-gold/12 bg-brand-gold/5 p-5">
        <Icon className="h-8 w-8 text-brand-gold/40" />
      </div>
      <p className="mt-5 font-serif text-xl font-bold">{title}</p>
      {body && <p className="mt-2 max-w-xs text-sm text-brand-blue-light/55">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function IconBadge({ icon: Icon, tone = "gold", size = "md" }: { icon: LucideIcon; tone?: "gold"|"teal"|"blue"|"red"; size?: "sm"|"md"|"lg" }) {
  return (
    <span className={cn("inline-flex items-center justify-center rounded-xl border",
      size === "sm" && "h-8 w-8", size === "md" && "h-10 w-10", size === "lg" && "h-12 w-12",
      tone === "gold" && "border-brand-gold/20 bg-brand-gold/12 text-brand-gold",
      tone === "teal" && "border-brand-teal/20 bg-brand-teal/10 text-brand-teal",
      tone === "blue" && "border-brand-accent/20 bg-brand-accent/10 text-brand-accent",
      tone === "red"  && "border-red-500/20 bg-red-500/10 text-red-500",
    )}>
      <Icon className={size === "sm" ? "h-4 w-4" : size === "md" ? "h-5 w-5" : "h-6 w-6"} />
    </span>
  );
}

export function StatusPill({ children, tone = "gold" }: { children: ReactNode; tone?: "gold"|"teal"|"blue"|"muted"|"red" }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
      tone === "gold"  && "border-brand-gold/25 bg-brand-gold/10 text-brand-gold",
      tone === "teal"  && "border-brand-teal/25 bg-brand-teal/10 text-brand-teal",
      tone === "blue"  && "border-brand-accent/25 bg-brand-accent/10 text-brand-accent",
      tone === "red"   && "border-red-500/20 bg-red-50 text-red-600",
      tone === "muted" && "border-black/10 bg-black/5 text-brand-blue-light/45",
    )}>
      {tone === "teal" && <span className="h-1.5 w-1.5 rounded-full bg-brand-teal animate-glow-pulse" />}
      {children}
    </span>
  );
}

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">{eyebrow}</p>}
        <h1 className="mt-1 font-serif text-4xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-brand-blue-light/55">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="h-px flex-1 bg-brand-gold/12" />
      <div className="h-1 w-1 rounded-full bg-brand-gold/30" />
      <div className="h-px flex-1 bg-brand-gold/12" />
    </div>
  );
}

export * from "./QuickStartGuide";
