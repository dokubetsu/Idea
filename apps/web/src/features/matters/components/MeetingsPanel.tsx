"use client";
import { useState } from "react";
import { Video, Calendar, Plus, Loader2 } from "lucide-react";
import { useMatter, useCreateMeeting, useUpdateMeeting } from "../hooks/useMatters";
import { Button, Input, Badge, Card, Select, useToast } from "@/shared/components/ui";

export function MeetingsPanel({ matterId, isLawyer }: { matterId: string; isLawyer?: boolean }) {
  const { data: matter } = useMatter(matterId);
  const createMeeting = useCreateMeeting(matterId);
  const updateMeeting = useUpdateMeeting(matterId);
  const toast = useToast();
  
  const [showForm, setShowForm] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState(30);
  const [meetingLink, setMeetingLink] = useState("");
  const [notes, setNotes] = useState("");

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledAt) return;
    try {
      await createMeeting.mutateAsync({
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_minutes: duration,
        meeting_link: meetingLink || undefined,
        notes: notes || undefined,
      });
      setShowForm(false);
      setScheduledAt("");
      setMeetingLink("");
      setNotes("");
      toast.success("Meeting scheduled successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to schedule meeting");
    }
  };

  const meetings = matter?.meetings || [];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-brand-gold/8 px-5 py-4">
        <div>
          <h3 className="font-serif text-xl font-bold flex items-center gap-2">
            <Video className="h-5 w-5 text-brand-gold" /> Video Meetings
          </h3>
          <p className="mt-1 text-xs text-brand-blue-light/50">Schedule and manage 1:1 sessions.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "ghost" : "secondary"} size="sm">
          {showForm ? "Cancel" : <><Plus className="h-4 w-4" /> Book Session</>}
        </Button>
      </div>

      <div className="p-5 space-y-5">
        {showForm && (
          <form onSubmit={handleBook} className="bg-base-200/50 p-4 rounded-xl border border-brand-gold/10 grid gap-4 sm:grid-cols-2">
            <Input 
              id="meeting_datetime"
              type="datetime-local" 
              label="Date & Time" 
              value={scheduledAt} 
              onChange={e => setScheduledAt(e.target.value)} 
              required 
            />
            <Input 
              id="meeting_duration"
              type="number" 
              label="Duration (minutes)" 
              value={duration === 0 ? "" : duration.toString()} 
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                setDuration(Number.isNaN(val) ? 0 : val);
              }} 
              required 
              min={15} max={120} step={15}
            />
            <div className="sm:col-span-2">
              <Input 
                id="meeting_link"
                label="Meeting Link (optional)" 
                placeholder="https://meet.google.com/..." 
                value={meetingLink} 
                onChange={e => setMeetingLink(e.target.value)} 
              />
            </div>
            <div className="sm:col-span-2">
              <Input 
                id="meeting_notes"
                label="Agenda / Notes" 
                placeholder="What will be discussed?" 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={createMeeting.isPending}>
                {createMeeting.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Schedule Meeting"}
              </Button>
            </div>
          </form>
        )}

        {meetings.length === 0 && !showForm ? (
          <div className="text-center py-6">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-gold/10 mb-2">
              <Calendar className="h-5 w-5 text-brand-gold" />
            </div>
            <p className="text-sm font-medium text-brand-blue-light/60">No meetings scheduled</p>
          </div>
        ) : (
          <div className="space-y-3">
            {meetings.map(m => (
              <div key={m.id} className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 border border-brand-gold/10 rounded-xl hover:border-brand-gold/20 transition-colors">
                <div className="flex gap-3 items-start">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gold/10 text-brand-gold">
                    <Video className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-brand-blue-dark">
                      {new Date(m.scheduled_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      <span className="text-xs font-normal text-brand-blue-light/50 ml-2">({m.duration_minutes} min)</span>
                    </p>
                    {m.meeting_link && (
                      <a href={m.meeting_link} target="_blank" rel="noreferrer" className="text-xs text-brand-gold hover:underline font-medium block mt-1">
                        Join Meeting →
                      </a>
                    )}
                    {m.notes && <p className="mt-2 text-xs text-brand-blue-light/60">{m.notes}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-start shrink-0">
                  <Badge tone={m.status === "scheduled" ? "gold" : m.status === "completed" ? "teal" : "muted"}>
                    {m.status}
                  </Badge>
                  {isLawyer && m.status === "scheduled" && (
                    <Select
                      defaultValue="scheduled"
                      onChange={(e) => updateMeeting.mutate({ meetingId: m.id, status: e.target.value })}
                      className="min-h-8 py-1 text-xs"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </Select>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
