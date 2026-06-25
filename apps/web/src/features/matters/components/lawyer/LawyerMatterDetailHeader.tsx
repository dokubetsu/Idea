"use client";

import { Matter } from "@/entities/types";
import { Badge } from "@/shared/components/ui";

interface LawyerMatterDetailHeaderProps {
  matter: Matter;
}

export function LawyerMatterDetailHeader({ matter }: LawyerMatterDetailHeaderProps) {
  return (
    <div className="border-b border-brand-gold/12 bg-gradient-to-r from-base-200/60 to-base-100 p-5">
      <div className="flex items-center gap-3">
        <Badge tone={matter.status === "active" ? "teal" : "gold"}>{matter.status}</Badge>
        <Badge tone="blue">{matter.priority} priority</Badge>
      </div>
      <h2 className="mt-2 font-serif text-2xl font-bold">{matter.title}</h2>
      <p className="mt-1 text-sm text-brand-blue-light/65 leading-relaxed">{matter.summary}</p>
    </div>
  );
}
