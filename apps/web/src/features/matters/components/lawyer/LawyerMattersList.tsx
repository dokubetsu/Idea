"use client";

import { Scale } from "lucide-react";
import { Matter } from "@/entities/types";
import { Card, Spinner } from "@/shared/components/ui";

const STATUS_DOT: Record<string, string> = {
  active: "bg-brand-teal", 
  matching: "bg-brand-accent",
  assessment: "bg-brand-accent", 
  intake: "bg-brand-gold", 
  resolved: "bg-base-300",
};

interface LawyerMattersListProps {
  matters: Matter[];
  selectedId?: string;
  onSelect: (m: Matter) => void;
  isLoading: boolean;
}

export function LawyerMattersList({ matters, selectedId, onSelect, isLoading }: LawyerMattersListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (matters.length === 0) {
    return (
      <Card className="p-6 text-center">
        <Scale className="mx-auto h-8 w-8 text-brand-blue-light/30 mb-2" />
        <p className="text-sm text-brand-blue-light/50">No matters registered yet.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {matters.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onSelect(m)}
          className={`w-full rounded-xl border p-4 text-left transition-all ${
            selectedId === m.id
              ? "border-brand-gold/40 bg-brand-gold/5 shadow-sm"
              : "border-brand-gold/12 bg-base-100 hover:border-brand-gold/25"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[m.status] ?? "bg-base-300"}`} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-blue-light/45">
              {m.status.replace("_", " ")}
            </span>
          </div>
          <p className="font-serif text-base font-bold line-clamp-1">{m.title}</p>
          <p className="mt-1 text-xs text-brand-blue-light/50 truncate">
            {m.client_email ? `Invite: ${m.client_email}` : m.user_name ? `Client: ${m.user_name}` : "Pending Invite"}
          </p>
        </button>
      ))}
    </div>
  );
}
