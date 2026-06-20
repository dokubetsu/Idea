"use client";
import { useState } from "react";
import { CheckCircle, Edit2, X } from "lucide-react";
import { useFacts, useVerifyFact } from "@/features/matters/hooks/useMatters";
import type { Fact } from "@/entities/types";

export function FactsPanel({ matterId, canVerify = false }: { matterId: string; canVerify?: boolean }) {
  const { data: facts = [], isLoading } = useFacts(matterId);
  const verifyFact = useVerifyFact(matterId);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  if (isLoading) return <div className="py-6 text-center text-sm text-brand-blue-light/40">Loading facts…</div>;
  if (!facts.length) return <div className="py-6 text-center text-sm text-brand-blue-light/40">No facts extracted yet.</div>;

  const verified   = facts.filter((f) => f.is_verified);
  const unverified = facts.filter((f) => !f.is_verified);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
          Extracted facts
        </p>
        <span className="text-[10px] text-brand-blue-light/40">
          {verified.length}/{facts.length} verified
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-base-300">
        <div className="h-full rounded-full bg-brand-teal transition-all"
          style={{ width: `${facts.length ? (verified.length / facts.length) * 100 : 0}%` }} />
      </div>

      <div className="space-y-2">
        {facts.map((fact) => (
          <FactRow
            key={fact.id} fact={fact} canVerify={canVerify}
            isEditing={editing === fact.id}
            editVal={editVal}
            onEdit={() => { setEditing(fact.id); setEditVal(fact.value); }}
            onEditChange={setEditVal}
            onEditCancel={() => setEditing(null)}
            onVerify={(value) => {
              verifyFact.mutate({ factId: fact.id, value, is_verified: true });
              setEditing(null);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function FactRow({
  fact, canVerify, isEditing, editVal,
  onEdit, onEditChange, onEditCancel, onVerify,
}: {
  fact: Fact; canVerify: boolean; isEditing: boolean; editVal: string;
  onEdit: () => void; onEditChange: (v: string) => void;
  onEditCancel: () => void; onVerify: (v?: string) => void;
}) {
  return (
    <div className={`rounded-xl border p-3 transition-all ${
      fact.is_verified
        ? "border-brand-teal/20 bg-brand-teal/4"
        : "border-brand-gold/12 bg-base-100"
    }`}>
      <div className="flex items-start gap-2.5">
        {fact.is_verified
          ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-teal" />
          : <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-gold/40" />
        }
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-blue-light/45">
            {fact.label ?? fact.key.replace(/_/g, " ")}
          </p>
          {isEditing ? (
            <div className="mt-1 flex gap-2">
              <input
                value={editVal}
                onChange={(e) => onEditChange(e.target.value)}
                className="flex-1 rounded-lg border border-brand-gold px-2.5 py-1 text-sm outline-none"
                autoFocus
              />
              <button type="button" onClick={() => onVerify(editVal)}
                className="rounded-lg bg-brand-teal px-2.5 py-1 text-xs font-semibold text-white">✓</button>
              <button type="button" onClick={onEditCancel}
                className="rounded-lg border border-base-300 px-2 py-1 text-xs text-brand-blue-light/50">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <p className="mt-0.5 text-sm font-semibold text-brand-blue-dark">{fact.value}</p>
          )}
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[9px] text-brand-blue-light/30">
              via {fact.source} · {Math.round(fact.confidence * 100)}% confidence
            </span>
          </div>
        </div>
        {canVerify && !fact.is_verified && !isEditing && (
          <div className="flex gap-1.5">
            <button type="button" onClick={onEdit}
              className="rounded-lg p-1.5 text-brand-blue-light/30 hover:bg-base-200 hover:text-brand-blue-dark transition-colors">
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => onVerify()}
              className="rounded-lg border border-brand-teal/25 bg-brand-teal/8 px-2.5 py-1 text-[10px] font-semibold text-brand-teal hover:bg-brand-teal/15 transition-colors">
              Verify
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
