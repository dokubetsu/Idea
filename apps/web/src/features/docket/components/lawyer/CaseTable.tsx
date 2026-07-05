"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Inbox } from "lucide-react";
import { Card, StatusPill, cn } from "@/shared/components/ui";
import type { CaseCard } from "@/features/docket/types";

type SortKey = "client_name" | "case_name" | "stage" | "next_hearing_at";
type SortDir = "asc" | "desc";

const STAGE_TONE: Record<string, "gold" | "teal" | "blue" | "muted" | "red"> = {
  filed: "gold",
  reply: "gold",
  evidence: "blue",
  arguments: "teal",
  judgment: "teal",
  active: "teal",
  matching: "blue",
  intake: "muted",
  assessment: "muted",
  draft: "muted",
  resolved: "gold",
  closed: "muted",
  appeal: "blue",
  archived: "muted",
};

const HEALTH_TONE: Record<string, string> = {
  good: "text-brand-teal",
  fair: "text-brand-gold",
  critical: "text-red-500",
  unknown: "text-brand-blue-light/35",
};

interface CaseTableProps {
  cases: CaseCard[];
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden="true" />;
  return dir === "asc"
    ? <ArrowUp className="h-3 w-3 text-brand-gold" aria-hidden="true" />
    : <ArrowDown className="h-3 w-3 text-brand-gold" aria-hidden="true" />;
}

type ColDef = { key: SortKey; label: string };

const COLUMNS: ColDef[] = [
  { key: "client_name", label: "Client" },
  { key: "case_name", label: "Case" },
  { key: "stage", label: "Stage" },
  { key: "next_hearing_at", label: "Next hearing" },
];

export function CaseTable({ cases }: CaseTableProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("client_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function handleRowNav(id: string) {
    router.push(`/lawyer/matters/${id}`);
  }

  function handleRowKeyDown(e: React.KeyboardEvent, id: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleRowNav(id);
    }
  }

  const sorted = [...cases].sort((a, b) => {
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    if (!av && bv) return 1;
    if (av && !bv) return -1;
    if (!av && !bv) return 0;
    const cmp = String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  if (cases.length === 0) {
    return (
      <Card className="flex flex-col items-center py-16 text-center">
        <Inbox className="h-8 w-8 text-brand-gold/35 mb-4" aria-hidden="true" />
        <p className="font-serif text-xl font-bold">No active matters</p>
        <p className="mt-2 max-w-xs text-sm text-brand-blue-light/55">
          You have no assigned cases yet.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[640px] border-collapse text-left"
          aria-label="Cases table"
        >
          <thead>
            <tr className="border-b border-brand-gold/10 bg-brand-gold/[0.02]">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className="px-4 py-3"
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold hover:text-brand-gold/75 transition-colors"
                    aria-label={`Sort by ${col.label}`}
                  >
                    {col.label}
                    <SortIndicator active={sortKey === col.key} dir={sortDir} />
                  </button>
                </th>
              ))}
              {/* Health — non-sortable */}
              <th scope="col" className="px-4 py-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
                  Health
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr
                key={c.id}
                onClick={() => handleRowNav(c.id)}
                onKeyDown={(e) => handleRowKeyDown(e, c.id)}
                tabIndex={0}
                aria-label={`${c.client_name} — ${c.case_name}`}
                className={cn(
                  "cursor-pointer border-b border-brand-gold/8 transition-colors",
                  "hover:bg-brand-gold/4 focus-visible:outline-none focus-visible:bg-brand-gold/6",
                  i === sorted.length - 1 && "border-b-0",
                )}
              >
                {/* Client */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-gold/20 bg-brand-gold/10 font-serif text-xs font-bold text-brand-gold"
                      aria-hidden="true"
                    >
                      {c.client_name.trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-brand-blue-dark truncate max-w-[130px]">
                          {c.client_name}
                        </p>
                        {c.is_urgent && (
                          <AlertTriangle
                            className="h-3 w-3 shrink-0 text-red-500"
                            aria-label="Urgent"
                          />
                        )}
                      </div>
                      {c.case_number && (
                        <p className="font-mono text-[10px] text-brand-blue-light/30">
                          {c.case_number}
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Case name */}
                <td className="px-4 py-3">
                  <p className="text-sm text-brand-blue-dark line-clamp-1 max-w-[200px]">
                    {c.case_name}
                  </p>
                  {c.category && (
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-brand-blue-light/40">
                      {c.category}
                    </p>
                  )}
                </td>

                {/* Stage */}
                <td className="px-4 py-3">
                  <StatusPill tone={STAGE_TONE[c.stage.toLowerCase()] ?? "muted"}>
                    {c.stage}
                  </StatusPill>
                </td>

                {/* Next hearing */}
                <td className="px-4 py-3">
                  {c.next_hearing_countdown ? (
                    <span className="text-sm font-semibold text-brand-blue-dark">
                      {c.next_hearing_countdown}
                    </span>
                  ) : (
                    <span className="text-sm text-brand-blue-light/30">—</span>
                  )}
                </td>

                {/* Health */}
                <td className="px-4 py-3">
                  {c.matter_health ? (
                    <span
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-[0.14em]",
                        HEALTH_TONE[c.matter_health.toLowerCase()] ?? "text-brand-blue-light/35",
                      )}
                    >
                      {c.matter_health}
                    </span>
                  ) : (
                    <span className="text-sm text-brand-blue-light/25">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-brand-gold/8 px-4 py-2.5">
        <p className="text-[11px] text-brand-blue-light/40">
          {sorted.length} matter{sorted.length !== 1 ? "s" : ""}
        </p>
      </div>
    </Card>
  );
}
