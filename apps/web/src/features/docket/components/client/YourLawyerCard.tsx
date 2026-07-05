"use client";

import { MessageSquare } from "lucide-react";
import { Card, Button } from "@/shared/components/ui";

interface Props {
  name: string;
  avatar: string | null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function YourLawyerCard({ name, avatar }: Props) {
  return (
    <Card className="p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-blue-light/50">
        Your lawyer
      </p>

      <div className="mt-4 flex items-center gap-4">
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className="h-12 w-12 shrink-0 rounded-full object-cover border border-brand-gold/15"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-blue-dark border border-brand-gold/20 font-serif text-sm font-bold text-brand-gold">
            {getInitials(name)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-serif text-lg font-bold text-brand-blue-dark truncate">
            {name}
          </p>
          <p className="mt-0.5 font-sans text-xs text-brand-blue-light/55">
            Typically responds within 24 hours
          </p>
        </div>
      </div>

      <div className="mt-5">
        <Button variant="secondary" size="md" aria-label={`Message ${name}`}>
          <MessageSquare className="h-4 w-4" />
          Message
        </Button>
      </div>
    </Card>
  );
}
