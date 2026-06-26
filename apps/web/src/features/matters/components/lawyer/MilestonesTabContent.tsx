"use client";

import { useState } from "react";
import { TrendingUp, Plus } from "lucide-react";
import { useCreateMilestone, useUpdateMilestone } from "@/features/matters/hooks/useMatters";
import { Button, Input, Badge } from "@/shared/components/ui";
import { Matter } from "@/entities/types";

interface MilestonesTabContentProps {
  matter: Matter;
  refetchDetails: () => void;
}

export function MilestonesTabContent({ matter, refetchDetails }: MilestonesTabContentProps) {
  const createMilestone = useCreateMilestone(matter.id);
  const updateMilestone = useUpdateMilestone(matter.id);

  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDesc, setMilestoneDesc] = useState("");
  const [milestoneAmount, setMilestoneAmount] = useState("");

  const milestones = matter.milestones || [];

  async function handleAddMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!milestoneTitle) return;
    const nextIndex = (milestones.length ?? 0) + 1;
    const parsedAmount = milestoneAmount ? parseInt(milestoneAmount, 10) : undefined;
    const finalAmount = parsedAmount !== undefined && !Number.isNaN(parsedAmount) ? parsedAmount : undefined;
    await createMilestone.mutateAsync({
      title: milestoneTitle,
      description: milestoneDesc || undefined,
      order_index: nextIndex,
      status: "pending",
      amount_inr: finalAmount
    });
    setMilestoneTitle("");
    setMilestoneDesc("");
    setMilestoneAmount("");
    refetchDetails();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-brand-gold/8 pb-3">
        <h3 className="font-serif text-xl font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-brand-gold" /> Case Milestone Tracker
        </h3>
      </div>

      {/* Add milestone form */}
      <form onSubmit={handleAddMilestone} className="grid gap-4 md:grid-cols-3 bg-base-200/30 p-4 rounded-xl border border-brand-gold/10">
        <div className="md:col-span-2">
          <Input
            label="Milestone Title"
            placeholder="e.g. Demand Notice Replied"
            value={milestoneTitle}
            onChange={(e) => setMilestoneTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <Input
            type="number"
            label="Billable Amount (₹)"
            placeholder="Optional"
            value={milestoneAmount}
            onChange={(e) => setMilestoneAmount(e.target.value)}
            min={0}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="secondary" className="w-full">
            <Plus className="h-3.5 w-3.5" /> Add Milestone
          </Button>
        </div>
      </form>

      {/* Milestones list */}
      <div className="relative border-l border-brand-gold/20 ml-4 pl-6 space-y-6">
        {milestones.map((m) => (
          <div key={m.id} className="relative group">
            {/* Dot indicator */}
            <div className={`absolute -left-[31px] top-0 h-4 w-4 rounded-full border-2 bg-white flex items-center justify-center transition-colors ${
              m.status === "completed" ? "border-brand-teal bg-brand-teal" : 
              m.status === "current" ? "border-brand-gold bg-brand-gold/20 scale-110" : "border-brand-gold/30"
            }`}>
              {m.status === "completed" && <span className="text-[8px] text-white">✓</span>}
              {m.status === "current" && <span className="h-1.5 w-1.5 rounded-full bg-brand-gold animate-ping" />}
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-sm font-bold ${m.status === "completed" ? "text-brand-blue-dark/50 line-through" : "text-brand-blue-dark"}`}>
                  {m.title}
                </p>
                {m.description && <p className="text-xs text-brand-blue-light/50 mt-0.5">{m.description}</p>}
                {m.amount_inr && <p className="text-xs text-brand-gold/70 mt-1 font-semibold">Billable: ₹{m.amount_inr.toLocaleString("en-IN")}</p>}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {m.status !== "completed" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-brand-teal border-brand-teal/20"
                    onClick={async () => {
                      await updateMilestone.mutateAsync({
                        milestoneId: m.id,
                        status: "completed",
                        completed_at: new Date().toISOString()
                      });
                      refetchDetails();
                    }}
                  >
                    Mark Complete
                  </Button>
                ) : (
                  <Badge tone="teal">Completed</Badge>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
