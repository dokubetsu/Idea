"use client";

import { Inbox } from "lucide-react";
import { EmptyState } from "@/shared/components/ui";
import { CaseCard } from "./CaseCard";
import type { CaseCard as CaseCardType } from "@/features/docket/types";

interface CaseGridProps {
  cases: CaseCardType[];
}

export function CaseGrid({ cases }: CaseGridProps) {
  if (cases.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No active matters"
        body="You have no assigned cases yet."
      />
    );
  }

  return (
    <div
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      role="list"
      aria-label="Case list"
    >
      {cases.map((c) => (
        <div key={c.id} role="listitem">
          <CaseCard caseData={c} />
        </div>
      ))}
    </div>
  );
}
