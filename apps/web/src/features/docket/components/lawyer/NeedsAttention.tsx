"use client";

import Link from "next/link";
import { AlertTriangle, AlertCircle, Info, Bell } from "lucide-react";
import { Card, EmptyState, cn } from "@/shared/components/ui";
import type { AttentionItem } from "@/features/docket/types";

interface NeedsAttentionProps {
  items: AttentionItem[];
}

const SEVERITY_CONFIG = {
  danger: {
    icon: AlertCircle,
    container: "border-red-500/15 bg-red-50/60",
    icon_class: "text-red-500",
    text: "text-red-700",
    meta: "text-red-500/70",
    dot: "bg-red-500",
  },
  warning: {
    icon: AlertTriangle,
    container: "border-amber-400/20 bg-amber-50/60",
    icon_class: "text-amber-500",
    text: "text-amber-800",
    meta: "text-amber-500/70",
    dot: "bg-amber-400",
  },
  info: {
    icon: Info,
    container: "border-brand-accent/15 bg-brand-accent/5",
    icon_class: "text-brand-accent",
    text: "text-brand-blue-dark",
    meta: "text-brand-blue-light/50",
    dot: "bg-brand-accent",
  },
} as const;

const TYPE_LABEL: Record<AttentionItem["type"], string> = {
  limitation_warning: "Limitation",
  upcoming_hearing: "Hearing",
  overdue: "Overdue",
  unread_message: "Message",
  pending_signature: "Signature",
};

export function NeedsAttention({ items }: NeedsAttentionProps) {
  const dangerItems = items.filter((i) => i.severity === "danger");
  const otherItems = items.filter((i) => i.severity !== "danger");
  const sorted = [...dangerItems, ...otherItems];

  return (
    <Card className="flex flex-col">
      <div className="border-b border-brand-gold/10 px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
            Needs attention
          </p>
          {items.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white tabular-nums">
              {items.length}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-brand-blue-light/55">
          {items.length === 0 ? "All clear" : `${items.length} item${items.length > 1 ? "s" : ""} require your action`}
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="px-5">
          <EmptyState
            icon={Bell}
            title="All clear"
            body="No pending items require attention right now."
          />
        </div>
      ) : (
        <ul className="divide-y divide-brand-gold/8" aria-label="Items needing attention">
          {sorted.map((item) => {
            const cfg = SEVERITY_CONFIG[item.severity];
            const Icon = cfg.icon;
            return (
              <li key={item.id}>
                <Link
                  href={`/lawyer/matters/${item.matter_id}`}
                  className={cn(
                    "group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-black/[0.02]",
                  )}
                  aria-label={item.message}
                >
                  {/* Icon badge */}
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                      cfg.container,
                    )}
                    aria-hidden="true"
                  >
                    <Icon className={cn("h-3.5 w-3.5", cfg.icon_class)} />
                  </span>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-block rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]",
                          item.severity === "danger" && "border-red-500/20 bg-red-50 text-red-600",
                          item.severity === "warning" && "border-amber-400/25 bg-amber-50 text-amber-700",
                          item.severity === "info" && "border-brand-accent/20 bg-brand-accent/8 text-brand-accent",
                        )}
                      >
                        {TYPE_LABEL[item.type]}
                      </span>
                    </div>
                    <p className={cn("mt-1 text-sm leading-snug", cfg.text)}>
                      {item.message}
                    </p>
                  </div>

                  {/* Severity indicator dot */}
                  <span
                    className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", cfg.dot)}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
