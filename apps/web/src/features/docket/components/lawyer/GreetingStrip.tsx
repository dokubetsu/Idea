"use client";

interface GreetingStripProps {
  greeting: string;
  dateDisplay: string;
  summaryLine: string;
}

export function GreetingStrip({ greeting, dateDisplay, summaryLine }: GreetingStripProps) {
  return (
    <div className="animate-fade-in-up">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
        Advocate workspace
      </p>
      <h1 className="mt-1 font-serif text-5xl font-bold text-brand-blue-dark">
        {greeting}
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm text-brand-blue-light/55">{dateDisplay}</span>
        <span className="h-1 w-1 rounded-full bg-brand-gold/40" aria-hidden="true" />
        <span className="text-sm text-brand-blue-light/55">{summaryLine}</span>
      </div>
    </div>
  );
}
