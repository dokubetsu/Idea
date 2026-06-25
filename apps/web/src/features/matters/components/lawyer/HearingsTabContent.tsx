"use client";

import { useState } from "react";
import { Calendar, Plus } from "lucide-react";
import { useCreateHearing, useUpdateHearing } from "@/features/matters/hooks/useMatters";
import { Button, Input, Select, Badge, Card } from "@/shared/components/ui";
import { Matter } from "@/entities/types";

interface HearingsTabContentProps {
  matter: Matter;
  refetchDetails: () => void;
}

export function HearingsTabContent({ matter, refetchDetails }: HearingsTabContentProps) {
  const createHearing = useCreateHearing(matter.id);
  const updateHearing = useUpdateHearing(matter.id);

  const [hearingDate, setHearingDate] = useState("");
  const [courtroom, setCourtroom] = useState("");
  const [judge, setJudge] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");

  const hearings = matter.hearings || [];

  async function handleAddHearing(e: React.FormEvent) {
    e.preventDefault();
    if (!hearingDate) return;
    await createHearing.mutateAsync({
      hearing_date: new Date(hearingDate).toISOString(),
      courtroom: courtroom || undefined,
      judge: judge || undefined,
      purpose: purpose || undefined,
      notes: notes || undefined,
      status: "scheduled"
    });
    setHearingDate("");
    setCourtroom("");
    setJudge("");
    setPurpose("");
    setNotes("");
    refetchDetails();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-brand-gold/8 pb-3">
        <h3 className="font-serif text-xl font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-brand-gold" /> Hearings Schedule
        </h3>
      </div>

      {/* Add hearing form */}
      <form onSubmit={handleAddHearing} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 bg-base-200/30 p-4 rounded-xl border border-brand-gold/10">
        <Input
          type="datetime-local"
          label="Hearing Date & Time"
          value={hearingDate}
          onChange={(e) => setHearingDate(e.target.value)}
          required
        />
        <Input
          label="Courtroom Number"
          placeholder="e.g. Courtroom No. 4"
          value={courtroom}
          onChange={(e) => setCourtroom(e.target.value)}
        />
        <Input
          label="Judge"
          placeholder="e.g. Justice Indu Malhotra"
          value={judge}
          onChange={(e) => setJudge(e.target.value)}
        />
        <Input
          label="Purpose"
          placeholder="e.g. Framing of Charges"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
        />
        <div className="md:col-span-2 lg:col-span-2">
          <Input
            label="Summary Notes"
            placeholder="Key directives, dates, or prep instructions"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="primary" className="w-full">
            <Plus className="h-3.5 w-3.5" /> Schedule Hearing
          </Button>
        </div>
      </form>

      {/* List of hearings */}
      <div className="space-y-3">
        {hearings.map((h) => (
          <Card key={h.id} className="p-4 border border-brand-gold/10 transition-all hover:border-brand-gold/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3 items-start">
                <Calendar className="h-5 w-5 text-brand-gold shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-brand-blue-dark">
                    {new Date(h.hearing_date).toLocaleDateString("en-IN", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-brand-blue-light/50">
                    {h.courtroom && <span>Courtroom: {h.courtroom}</span>}
                    {h.judge && <span>Judge: {h.judge}</span>}
                    {h.purpose && <span>Purpose: {h.purpose}</span>}
                  </div>
                  {h.notes && <p className="mt-2 text-xs bg-base-200/50 p-2.5 rounded-lg border border-brand-gold/5 whitespace-pre-line">{h.notes}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-start">
                <Badge tone={h.status === "scheduled" ? "gold" : "muted"}>{h.status}</Badge>
                {h.status === "scheduled" && (
                  <Select
                    defaultValue="scheduled"
                    onChange={async (e) => {
                      await updateHearing.mutateAsync({
                        hearingId: h.id,
                        status: e.target.value
                      });
                      refetchDetails();
                    }}
                    className="min-h-8 py-1 text-xs"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="held">Held</option>
                    <option value="postponed">Postponed</option>
                    <option value="cancelled">Cancelled</option>
                  </Select>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
