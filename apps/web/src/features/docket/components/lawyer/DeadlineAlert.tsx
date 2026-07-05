"use client";

import { Clock } from "lucide-react";

interface DeadlineAlertProps {
  message: string | null;
}

export default function DeadlineAlert({ message }: DeadlineAlertProps) {
  if (!message) return null;

  return (
    <div className="w-full rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
      <Clock className="h-4 w-4 text-amber-800 shrink-0" />
      <span className="text-[13px] font-sans text-amber-800">{message}</span>
    </div>
  );
}
