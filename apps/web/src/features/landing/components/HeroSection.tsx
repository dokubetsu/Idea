"use client";

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { LANDING_COPY } from "@/app/landingCopy";

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center items-center text-center px-4 sm:px-6 pt-32 lg:pt-24 z-20">
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
        {/* Tagline Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/20 bg-brand-gold/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-gold">
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          <span>{LANDING_COPY.hero.badge}</span>
        </div>

        {/* Hero Headline */}
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] text-white">
          {LANDING_COPY.hero.titleLine1} <br />
          <span className="gold-text">{LANDING_COPY.hero.titleLine2}</span>
        </h1>

        {/* Subheading */}
        <p className="max-w-2xl mx-auto text-base md:text-xl text-white/55 font-medium leading-relaxed">
          {LANDING_COPY.hero.subheading}
        </p>

        {/* Call-to-actions */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
          <Link
            href="/register"
            className="shimmer-btn w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-brand-gold px-8 py-4 text-sm font-bold uppercase tracking-wider text-[#050b14] hover:bg-brand-gold-light hover:shadow-lg transition-all"
          >
            {LANDING_COPY.hero.ctaPrimary} <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#demo"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 py-4 text-sm font-bold uppercase tracking-wider text-white hover:bg-white/10 hover:border-white/20 transition-all"
          >
            {LANDING_COPY.hero.ctaSecondary}
          </a>
        </div>

        {/* Trust Banner / Social Proof Row */}
        <div className="pt-12 border-t border-white/5 w-full max-w-3xl mx-auto flex flex-col items-center gap-6">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/35">
            {LANDING_COPY.trust.badge}
          </span>
          <div className="grid grid-cols-3 gap-4 sm:gap-12 w-full text-center">
            {LANDING_COPY.trust.metrics.map((m, idx) => (
              <div key={idx} className="space-y-1">
                <div className="font-serif text-2xl sm:text-4xl font-extrabold text-brand-gold">
                  {m.value}{m.suffix}
                </div>
                <div className="text-[9px] sm:text-xs font-mono uppercase tracking-wider text-white/40">
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30 text-[10px] font-bold uppercase tracking-[0.2em] pointer-events-none">
        <span>{LANDING_COPY.hero.scrollExplore}</span>
        <div className="h-10 w-[1px] bg-gradient-to-b from-brand-gold/50 to-transparent animate-bounce mt-1" />
      </div>
    </section>
  );
}
