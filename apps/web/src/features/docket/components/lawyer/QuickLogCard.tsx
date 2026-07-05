"use client";

import { useState } from "react";
import { Card, Button, Input } from "@/shared/components/ui";
import { useLogTime, useCreateNote } from "@/features/docket/hooks/useCaseOverview";

interface QuickLogCardProps {
  matterId: string;
}

export default function QuickLogCard({ matterId }: QuickLogCardProps) {
  const [activity, setActivity] = useState("");
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");

  const logTime = useLogTime(matterId);
  const createNote = useCreateNote(matterId);

  const handleLogTime = async () => {
    if (!activity.trim() || !hours) return;
    await logTime.mutateAsync({
      activity: activity.trim(),
      hours: parseFloat(hours),
    });
    setActivity("");
    setHours("");
  };

  const handleSaveNote = async () => {
    if (!note.trim()) return;
    await createNote.mutateAsync(note.trim());
    setNote("");
  };

  return (
    <Card className="rounded-xl border border-brand-gold/12 bg-base-100 shadow-sm p-4">
      <h3 className="text-sm font-serif font-semibold text-foreground mb-3">
        Quick log
      </h3>

      {/* Row 1: Time log */}
      <div className="flex items-center gap-2 mb-3">
        <Input
          type="text"
          placeholder="Activity description"
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          className="flex-1 text-[11px]"
          aria-label="Activity description"
        />
        <Input
          type="number"
          placeholder="Hrs"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          min="0"
          step="0.25"
          className="w-16 text-[11px]"
          aria-label="Hours spent"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={handleLogTime}
          disabled={logTime.isPending || !activity.trim() || !hours}
          aria-label="Log time entry"
        >
          Log
        </Button>
      </div>

      {/* Row 2: Internal note */}
      <div className="flex items-start gap-2">
        <textarea
          placeholder="Internal note..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="flex-1 rounded-md border border-brand-gold/12 bg-base-100 px-3 py-2 text-[11px] font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-gold/30 resize-none"
          aria-label="Internal note"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSaveNote}
          disabled={createNote.isPending || !note.trim()}
          aria-label="Save internal note"
        >
          Save
        </Button>
      </div>
    </Card>
  );
}
