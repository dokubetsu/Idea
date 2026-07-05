"use client";

import { Construction } from "lucide-react";
import { EmptyState } from "@/shared/components/ui";

interface Props {
  tabName: string;
}

export function StubTab({ tabName }: Props) {
  return (
    <EmptyState
      icon={Construction}
      title={tabName}
      body="Coming soon"
    />
  );
}
