"use client";

import { useState } from "react";
import { LayoutGrid, List, Calendar } from "lucide-react";
import { Spinner, EmptyState, cn } from "@/shared/components/ui";
import { useLawyerDashboard } from "@/features/docket/hooks/useLawyerDashboard";
import { GreetingStrip } from "@/features/docket/components/lawyer/GreetingStrip";
import { KpiStrip } from "@/features/docket/components/lawyer/KpiStrip";
import { TodayInCourt } from "@/features/docket/components/lawyer/TodayInCourt";
import { NeedsAttention } from "@/features/docket/components/lawyer/NeedsAttention";
import { CaseGrid } from "@/features/docket/components/lawyer/CaseGrid";
import { CaseTable } from "@/features/docket/components/lawyer/CaseTable";
import { CalendarPeek } from "@/features/docket/components/lawyer/CalendarPeek";

export default function LawyerDashboardPage() {
  const { data, isLoading } = useLawyerDashboard();
  const [view, setView] = useState<"grid" | "table">("grid");

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={Calendar}
        title="No data available"
        body="We couldn't load your dashboard. Please try again."
      />
    );
  }

  // Extract hearing dates for calendar
  const hearingDates = data.today_hearings.map((h) => {
    // These are today's hearings; collect unique dates from cases for calendar
    return new Date().toISOString().split("T")[0];
  });

  // Collect next_hearing_at from cases for the calendar
  const calendarDates = data.cases
    .map((c) => c.next_hearing_at)
    .filter((d): d is string => !!d);

  return (
    <div className="animate-fade-in-up max-w-7xl mx-auto space-y-9">
      {/* Greeting */}
      <GreetingStrip
        greeting={data.greeting}
        dateDisplay={data.date_display}
        summaryLine={data.summary_line}
      />

      {/* KPI strip */}
      <KpiStrip kpis={data.kpis} />

      {/* Today + Needs attention */}
      <div className="grid gap-5 lg:grid-cols-2">
        <TodayInCourt hearings={data.today_hearings} />
        <NeedsAttention items={data.attention_items} />
      </div>

      {/* Cases section header with toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
            My clients & cases
          </p>
          <p className="mt-0.5 text-xs text-brand-blue-light/45">
            {data.cases.length} active matter{data.cases.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-brand-gold/12 p-0.5">
          <button
            type="button"
            onClick={() => setView("grid")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-all",
              view === "grid"
                ? "bg-brand-gold/12 text-brand-gold"
                : "text-brand-blue-light/40 hover:text-brand-blue-light/60"
            )}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Grid
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-all",
              view === "table"
                ? "bg-brand-gold/12 text-brand-gold"
                : "text-brand-blue-light/40 hover:text-brand-blue-light/60"
            )}
            aria-label="Table view"
          >
            <List className="h-3.5 w-3.5" />
            Table
          </button>
        </div>
      </div>

      {/* Cases */}
      {view === "grid" ? (
        <CaseGrid cases={data.cases} />
      ) : (
        <CaseTable cases={data.cases} />
      )}

      {/* Calendar peek */}
      <CalendarPeek hearingDates={calendarDates} />
    </div>
  );
}
