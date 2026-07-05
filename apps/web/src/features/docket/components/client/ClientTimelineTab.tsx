"use client";

import {
  Calendar,
  FileText,
  MessageSquare,
  Receipt,
  Flag,
  Circle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { useCaseTimeline } from "@/features/docket/hooks/useCaseOverview";
import { Card, Spinner, EmptyState, cn } from "@/shared/components/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  matterId: string;
}

interface TimelineEvent {
  id: string;
  description: string;
  occurred_at: string;
  event_type: string;
  metadata?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) return "today";
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  return formatDate(iso);
}

type EventStyle = {
  icon: React.ElementType;
  dotClass: string;
};

function getEventStyle(eventType: string): EventStyle {
  switch (eventType) {
    case "hearing_scheduled":
    case "hearing_completed":
      return { icon: Calendar, dotClass: "bg-blue-500/15 text-blue-600 border-blue-500/25" };
    case "document_approved":
    case "document_rejected":
      return { icon: FileText, dotClass: "bg-amber-500/15 text-amber-600 border-amber-500/25" };
    case "nudge":
    case "message":
      return { icon: MessageSquare, dotClass: "bg-purple-500/15 text-purple-600 border-purple-500/25" };
    case "payment":
    case "invoice":
      return { icon: Receipt, dotClass: "bg-green-500/15 text-green-600 border-green-500/25" };
    case "case_filed":
    case "milestone":
      return { icon: Flag, dotClass: "bg-brand-gold/15 text-brand-gold border-brand-gold/25" };
    default:
      return { icon: Circle, dotClass: "bg-gray-200 text-gray-400 border-gray-300/30" };
  }
}

function getNextAction(events: TimelineEvent[]): TimelineEvent | null {
  const now = Date.now();
  const futureEvents = events
    .filter((e) => new Date(e.occurred_at).getTime() > now)
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

  if (futureEvents.length > 0) return futureEvents[0];

  // Fall back to most recent hearing-related or milestone event
  const actionable = events.find(
    (e) =>
      e.event_type === "hearing_scheduled" ||
      e.event_type === "milestone"
  );
  return actionable || null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClientTimelineTab({ matterId }: Props) {
  const { data: events = [], isLoading } = useCaseTimeline(matterId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  if (!events.length) {
    return (
      <EmptyState
        icon={Clock}
        title="No timeline events yet"
        body="Your case timeline will appear here as things happen. Check back after your first hearing."
      />
    );
  }

  // Sort newest to oldest
  const sorted = [...events].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  );

  const nextAction = getNextAction(events);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-serif text-xl font-bold text-brand-blue-dark">
          Your case journey
        </h2>
        <p className="mt-1 text-sm text-brand-blue-light/55">
          Here&apos;s everything that&apos;s happened in your case, from newest to oldest.
        </p>
      </div>

      {/* What's next card */}
      {nextAction && (
        <div className="rounded-xl border border-brand-gold/12 border-l-4 border-l-brand-accent bg-brand-accent/5 p-4">
          <div className="flex items-center gap-3">
            <ArrowRight className="h-4 w-4 text-brand-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
                Next up
              </p>
              <p className="mt-0.5 text-sm font-medium text-brand-blue-dark truncate">
                {nextAction.description}
              </p>
            </div>
            <span className="text-[11px] text-brand-blue-light/40 whitespace-nowrap">
              {formatDate(nextAction.occurred_at)}
            </span>
          </div>
        </div>
      )}

      {/* Vertical timeline */}
      <div className="relative pl-10">
        {/* Vertical line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-0.5 border-l-2 border-brand-gold/20" />

        <div className="space-y-4">
          {sorted.map((event) => {
            const { icon: Icon, dotClass } = getEventStyle(event.event_type);
            return (
              <div key={event.id} className="relative flex items-start gap-4">
                {/* Dot on the line */}
                <div
                  className={cn(
                    "absolute -left-10 h-8 w-8 rounded-full flex items-center justify-center border",
                    dotClass
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>

                {/* Event content */}
                <Card hover className="flex-1 p-3.5">
                  <p className="text-sm text-brand-blue-light/70">
                    {event.description}
                  </p>
                  <p className="mt-1.5 text-[11px] text-brand-blue-light/40">
                    {formatDate(event.occurred_at)}
                    <span className="mx-1.5">&middot;</span>
                    {relativeTime(event.occurred_at)}
                  </p>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
