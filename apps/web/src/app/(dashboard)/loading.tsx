"use client";

export default function Loading() {
  return (
    <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-4">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-4 border-brand-gold/10" />
        <div className="absolute inset-0 rounded-full border-4 border-brand-gold border-t-transparent animate-spin" />
      </div>
      <p className="text-sm font-medium text-brand-blue-light/60 animate-pulse">Loading dashboard content...</p>
    </div>
  );
}
