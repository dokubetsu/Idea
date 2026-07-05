"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, cn } from "@/shared/components/ui";
import type { KpiCard } from "@/features/docket/types";

interface KpiStripProps {
  kpis: KpiCard[];
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend.startsWith("+")) {
    return <TrendingUp className="h-3.5 w-3.5 text-brand-teal" aria-hidden="true" />;
  }
  if (trend.startsWith("-")) {
    return <TrendingDown className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />;
  }
  return <Minus className="h-3.5 w-3.5 text-brand-blue-light/35" aria-hidden="true" />;
}

function trendColor(trend: string) {
  if (trend.startsWith("+")) return "text-brand-teal";
  if (trend.startsWith("-")) return "text-red-500";
  return "text-brand-blue-light/35";
}

export function KpiStrip({ kpis }: KpiStripProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {kpis.map((kpi, i) => (
        <Card key={i} className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
            {kpi.caption}
          </p>
          <p className="mt-2 font-serif text-3xl font-bold text-brand-blue-dark">
            {kpi.value}
          </p>
          {kpi.trend && (
            <div className={cn("mt-1.5 flex items-center gap-1 text-[11px] font-semibold", trendColor(kpi.trend))}>
              <TrendIcon trend={kpi.trend} />
              <span>{kpi.trend}</span>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
