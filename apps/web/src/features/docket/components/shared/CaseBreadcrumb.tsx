"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/shared/components/ui";

interface CaseBreadcrumbProps {
  role: "lawyer" | "user";
  caseName: string;
}

export default function CaseBreadcrumb({ role, caseName }: CaseBreadcrumbProps) {
  const dashboardHref = `/${role}/dashboard`;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-sm font-sans"
    >
      <Link
        href={dashboardHref}
        className={cn(
          "text-brand-blue-light/60 hover:text-brand-gold",
          "transition-colors duration-150"
        )}
      >
        Dashboard
      </Link>
      <ChevronRight
        className="h-3.5 w-3.5 shrink-0 text-brand-blue-light/30"
        aria-hidden="true"
      />
      <span className="truncate font-medium text-brand-blue-dark">
        {caseName}
      </span>
    </nav>
  );
}
