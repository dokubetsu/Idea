"use client";

import React from "react";
import { Phone, MessageSquare, Mail, Video } from "lucide-react";
import { cn } from "@/shared/components/ui";

interface ContactBarProps {
  clientName: string;
  clientPhone: string | null;
}

const ACTIONS = [
  { icon: Phone, label: "Call" },
  { icon: MessageSquare, label: "Message" },
  { icon: Mail, label: "Email" },
  { icon: Video, label: "Video call" },
] as const;

export default function ContactBar({ clientName, clientPhone }: ContactBarProps) {
  return (
    <div className="flex items-center gap-2" role="toolbar" aria-label={`Contact ${clientName}`}>
      {ACTIONS.map(({ icon: Icon, label }) => (
        <button
          key={label}
          type="button"
          aria-label={`${label} ${clientName}${label === "Call" && clientPhone ? ` at ${clientPhone}` : ""}`}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center",
            "rounded-xl border border-brand-gold/12 bg-transparent",
            "text-brand-blue-light/70 transition-colors duration-150",
            "hover:bg-brand-gold/8 hover:text-brand-gold",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40"
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
