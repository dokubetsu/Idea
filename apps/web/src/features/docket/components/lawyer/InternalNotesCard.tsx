"use client";

import { Lock } from "lucide-react";
import { Card, Badge } from "@/shared/components/ui";

interface Note {
  id: string;
  content: string;
  created_at: string;
}

interface InternalNotesCardProps {
  notes: Note[];
}

export default function InternalNotesCard({ notes }: InternalNotesCardProps) {
  const visibleNotes = notes.slice(0, 3);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncate = (text: string, maxLength = 120) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trimEnd() + "…";
  };

  return (
    <Card className="rounded-xl border border-brand-gold/12 bg-base-200 shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Lock className="h-3.5 w-3.5 text-brand-blue-dark" />
        <h3 className="text-sm font-serif font-semibold text-foreground">
          Internal notes
        </h3>
        <Badge tone="muted" className="text-[9px] uppercase tracking-wider">
          Privileged
        </Badge>
      </div>

      {/* Notes list */}
      {visibleNotes.length === 0 ? (
        <p className="text-[11px] font-sans text-muted-foreground">
          No internal notes yet.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {visibleNotes.map((note) => (
            <li
              key={note.id}
              className="border-l-2 border-brand-blue-dark/20 pl-3"
            >
              <p className="text-[11px] font-sans text-foreground leading-relaxed">
                {truncate(note.content)}
              </p>
              <span className="block text-[10px] font-sans text-muted-foreground mt-0.5">
                {formatDate(note.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
