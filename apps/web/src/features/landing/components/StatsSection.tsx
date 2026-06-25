"use client";

import { useEffect, useRef, useState } from "react";
import { LANDING_COPY } from "@/app/landingCopy";

export function StatsSection() {
  return (
    <section id="stats" className="py-16 md:py-24 px-4 sm:px-6 relative z-20 reveal-hidden">
      <div className="max-w-5xl mx-auto grid gap-8 md:grid-cols-3 text-center">
        {LANDING_COPY.trust.metrics.map((m, idx) => (
          <MetricWidget key={idx} value={m.value} suffix={m.suffix} label={m.label} />
        ))}
      </div>
    </section>
  );
}

function MetricWidget({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const [count, setCount] = useState(0);
  const widgetRef = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !animated) {
          setAnimated(true);
        }
      },
      { threshold: 0.1 }
    );
    if (widgetRef.current) {
      observer.observe(widgetRef.current);
    }
    return () => observer.disconnect();
  }, [animated]);

  useEffect(() => {
    if (!animated) return;
    let start = 0;
    const duration = 1500;
    const increment = value / (duration / 16); // ~60fps
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [animated, value]);

  return (
    <div ref={widgetRef} className="rounded-2xl border border-white/10 bg-[#050b14]/50 p-6 space-y-2">
      <p className="font-serif text-5xl md:text-6xl font-black text-brand-gold">
        {count}
        {suffix}
      </p>
      <p className="text-xs font-mono uppercase tracking-wider text-white/40">{label}</p>
    </div>
  );
}
