"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
import { LANDING_COPY } from "@/app/landingCopy";

export function CinematicCompare() {
  return (
    <section className="py-16 md:py-24 px-4 sm:px-6 relative z-20 reveal-hidden bg-brand-blue-dark/20 border-y border-white/5">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">{LANDING_COPY.compare.badge}</p>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-white">{LANDING_COPY.compare.title}</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Old World Card */}
          <div className="relative overflow-hidden rounded-2xl border border-red-500/10 bg-red-950/5 p-6 sm:p-8 space-y-5 transition-all duration-300 hover:border-red-500/20 group">
            <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="font-serif text-xl font-bold text-red-400">{LANDING_COPY.compare.traditional.title}</h3>
            <ul className="space-y-3 font-mono text-xs text-white/40">
              {LANDING_COPY.compare.traditional.points.map((pt, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> {pt}
                </li>
              ))}
            </ul>
          </div>

          {/* Modern Card */}
          <div className="relative overflow-hidden rounded-2xl border border-brand-gold/15 bg-brand-gold/4 p-6 sm:p-8 space-y-5 transition-all duration-300 hover:border-brand-gold/30 group">
            <div className="h-10 w-10 rounded-xl bg-brand-gold/15 flex items-center justify-center text-brand-gold border border-brand-gold/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="font-serif text-xl font-bold text-brand-gold">{LANDING_COPY.compare.lead.title}</h3>
            <ul className="space-y-3 font-mono text-xs text-white/80">
              {LANDING_COPY.compare.lead.points.map((pt, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" /> {pt}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
