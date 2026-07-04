"use client";

import React from "react";
import { cn } from "@/shared/components/ui";

interface CaseTabsProps {
  role: "lawyer" | "user";
  activeTab: string;
  onTabChange: (tab: string) => void;
  matterId: string;
}

interface Tab {
  id: string;
  label: string;
}

const LAWYER_TABS: Tab[] = [
  { id: "overview", label: "Overview" },
  { id: "hearings", label: "Hearings" },
  { id: "documents", label: "Documents" },
  { id: "communications", label: "Communications" },
  { id: "billing", label: "Billing" },
  { id: "timeline", label: "Timeline" },
];

const CLIENT_TABS: Tab[] = [
  { id: "overview", label: "Overview" },
  { id: "documents", label: "Documents" },
  { id: "messages", label: "Messages" },
  { id: "billing", label: "Billing" },
  { id: "timeline", label: "Timeline" },
];

export default function CaseTabs({
  role,
  activeTab,
  onTabChange,
  matterId,
}: CaseTabsProps) {
  const tabs = role === "lawyer" ? LAWYER_TABS : CLIENT_TABS;

  return (
    <div
      role="tablist"
      aria-label="Case sections"
      className={cn(
        "flex items-center gap-1 overflow-x-auto",
        "scrollbar-none -mx-1 px-1 pb-0.5"
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${matterId}-${tab.id}`}
            id={`tab-${matterId}-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative shrink-0 rounded-lg px-4 py-2 text-sm font-sans font-medium",
              "transition-colors duration-150 outline-none",
              "focus-visible:ring-2 focus-visible:ring-brand-gold/40",
              isActive
                ? "border-b-2 border-brand-gold text-brand-gold"
                : "text-brand-blue-light/50 hover:text-brand-blue-light/80"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
