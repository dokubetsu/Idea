"use client";

import { FileText } from "lucide-react";
import { Card } from "@/shared/components/ui";

interface Props {
  feeDescription: string | null;
  engagementDocPath: string | null;
}

export function HowYouAreBilled({ feeDescription, engagementDocPath }: Props) {
  if (!feeDescription) return null;

  return (
    <Card className="p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold mb-3">
        How you&apos;re billed
      </p>
      <p className="text-sm leading-relaxed text-brand-blue-light/65">
        {feeDescription}
      </p>
      {engagementDocPath && (
        <a
          href={engagementDocPath}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-gold hover:text-brand-gold-light transition-colors"
          aria-label="View engagement letter"
        >
          <FileText className="h-3.5 w-3.5" />
          View engagement letter
        </a>
      )}
    </Card>
  );
}
