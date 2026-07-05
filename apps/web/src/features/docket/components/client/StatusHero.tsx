"use client";

import { Card, cn } from "@/shared/components/ui";

const STAGES = ["Filed", "Reply", "Evidence", "Arguments", "Judgment"] as const;

interface Props {
  stage: string;
  statusText: string;
}

export function StatusHero({ stage, statusText }: Props) {
  const currentIndex = STAGES.findIndex(
    (s) => s.toLowerCase() === stage.toLowerCase()
  );

  return (
    <Card className="p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-blue-light/50">
        Where things stand
      </p>

      <p className="mt-2 font-sans text-sm leading-relaxed text-brand-blue-dark">
        {statusText}
      </p>

      {/* 5-stage progress bar */}
      <div className="mt-5">
        <div className="flex items-center gap-1.5">
          {STAGES.map((s, i) => {
            const isCompleted = i < currentIndex;
            const isCurrent = i === currentIndex;

            return (
              <div key={s} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "h-2 w-full rounded-full transition-colors",
                    isCompleted && "bg-brand-teal",
                    isCurrent && "bg-brand-gold",
                    !isCompleted && !isCurrent && "bg-base-300"
                  )}
                />
                <span
                  className={cn(
                    "text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap",
                    isCompleted && "text-brand-teal",
                    isCurrent && "text-brand-gold",
                    !isCompleted && !isCurrent && "text-brand-blue-light/35"
                  )}
                >
                  {s}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
