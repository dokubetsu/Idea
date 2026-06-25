"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { LANDING_COPY } from "@/app/landingCopy";

export function LandingFooter() {
  return (
    <>
      {/* Testimonials (Sleek Beta Strip) */}
      <section className="py-16 md:py-24 px-4 sm:px-6 relative z-20 reveal-hidden max-w-4xl mx-auto text-center space-y-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">{LANDING_COPY.testimonial.badge}</p>
        <blockquote className="font-serif text-2xl md:text-3xl font-medium text-white/85 leading-relaxed">
          {LANDING_COPY.testimonial.quote}
        </blockquote>
        <p className="text-xs text-brand-gold font-mono uppercase tracking-wider">{LANDING_COPY.testimonial.author}</p>
      </section>

      {/* Immersive CTA */}
      <section className="min-h-screen flex flex-col justify-center items-center text-center px-4 sm:px-6 relative z-20 reveal-hidden">
        <div className="max-w-4xl mx-auto space-y-8">
          <h2 className="font-serif text-5xl md:text-7xl font-bold tracking-tight text-white leading-tight">
            {LANDING_COPY.bottomCta.titleLine1} <br />
            {LANDING_COPY.bottomCta.titleLine2}
          </h2>
          <p className="max-w-xl mx-auto text-base text-white/50 leading-relaxed">
            {LANDING_COPY.bottomCta.subheading}
          </p>

          <div className="pt-6">
            <Link
              href="/register"
              className="shimmer-btn inline-flex items-center gap-3 rounded-full bg-brand-gold px-8 py-4 text-sm font-bold uppercase tracking-wider text-[#050b14] hover:bg-brand-gold-light hover:shadow-lg transition-all"
            >
              {LANDING_COPY.bottomCta.cta} <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 text-center text-xs text-white/30 font-mono relative z-20">
        <p>{LANDING_COPY.footer.text}</p>
      </footer>
    </>
  );
}
