"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-5 rounded-2xl border border-red-200 bg-red-50/40 p-8 text-center backdrop-blur-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      
      <div className="max-w-md">
        <h2 className="font-serif text-xl font-bold text-brand-blue-dark">Dashboard error encountered</h2>
        <p className="mt-2 text-sm text-brand-blue-light/75">
          {error.message || "An unexpected error occurred while loading this dashboard view."}
        </p>
        {error.digest && (
          <p className="mt-1 text-[11px] font-mono text-brand-blue-light/50">
            Error ID: {error.digest}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-xs font-semibold text-brand-blue-dark transition hover:bg-brand-gold-light"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-brand-gold/20 bg-white px-4 py-2.5 text-xs font-semibold text-brand-blue-dark transition hover:bg-brand-gold/5"
        >
          <Home className="h-3.5 w-3.5" /> Go home
        </Link>
      </div>
    </div>
  );
}
