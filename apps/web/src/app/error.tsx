"use client";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled runtime error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base-100 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/8 text-red-500">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h1 className="mt-6 font-serif text-3xl font-bold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-brand-blue-light/55">
        An unexpected error occurred. Please try reloading the page or reset the workspace view.
      </p>
      {error.message && process.env.NODE_ENV !== "production" && (
        <pre className="mt-4 max-w-lg overflow-x-auto rounded-xl bg-base-200 p-4 text-left text-xs text-red-600">
          {error.message}
        </pre>
      )}

      <button
        onClick={() => reset()}
        className="mt-8 inline-flex items-center gap-2 rounded-xl border border-brand-gold bg-brand-gold/15 px-5 py-2.5 text-sm font-semibold text-brand-gold transition-all hover:bg-brand-gold/25"
      >
        <RotateCcw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}
