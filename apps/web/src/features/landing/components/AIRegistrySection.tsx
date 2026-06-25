"use client";

import { FileText, CheckCircle2 } from "lucide-react";
import { LANDING_COPY } from "@/app/landingCopy";

export function AIRegistrySection() {
  return (
    <section id="registry" className="py-16 md:py-24 px-4 sm:px-6 relative z-20 reveal-hidden bg-brand-blue-dark/20 border-y border-white/5">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">{LANDING_COPY.registry.badge}</p>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-white">{LANDING_COPY.registry.title}</h2>
          <p className="text-sm text-white/55">
            {LANDING_COPY.registry.subheading}
          </p>
        </div>

        {/* Registry Diagram Block */}
        <div className="max-w-3xl mx-auto bg-[#020509] border border-white/5 rounded-2xl p-5 sm:p-8 space-y-8 relative overflow-hidden w-full">
          <div className="flex justify-between items-center relative z-10 gap-4">
            <div className="space-y-1 flex-1 min-w-0">
              <p className="text-xs font-bold text-white uppercase tracking-wider truncate">{LANDING_COPY.registry.pipelineTitle}</p>
              <p className="text-[10px] text-white/45 truncate">{LANDING_COPY.registry.pipelineDesc}</p>
            </div>
            <span className="rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-0.5 text-[9px] font-bold text-brand-gold shrink-0">{LANDING_COPY.registry.badgeActive}</span>
          </div>

          <div className="grid gap-6 md:grid-cols-4 items-center relative z-10">
            <div className="bg-[#050b14] border border-white/8 rounded-xl p-4 text-center">
              <FileText className="h-5 w-5 text-brand-gold mx-auto mb-2" />
              <p className="text-xs font-bold">Intake prompt</p>
              <p className="text-[9px] text-white/40 mt-1">ContextBuilder</p>
            </div>

            <div className="md:col-span-2 flex flex-col gap-2">
              <div className="flex items-center justify-between bg-brand-gold/10 border border-brand-gold/30 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-brand-gold animate-pulse" />
                  <span className="text-xs font-bold text-white">{LANDING_COPY.registry.primary}</span>
                </div>
                <span className="text-[8px] text-brand-gold uppercase font-bold">{LANDING_COPY.registry.primaryRole}</span>
              </div>
              <div className="flex items-center justify-between bg-white/5 border border-white/8 rounded-xl p-3 opacity-60">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-white/20" />
                  <span className="text-xs font-bold text-white">{LANDING_COPY.registry.secondary}</span>
                </div>
                <span className="text-[8px] text-white/40 uppercase">{LANDING_COPY.registry.secondaryRole}</span>
              </div>
              <div className="flex items-center justify-between bg-white/5 border border-white/8 rounded-xl p-3 opacity-60">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-white/20" />
                  <span className="text-xs font-bold text-white">{LANDING_COPY.registry.offline}</span>
                </div>
                <span className="text-[8px] text-white/40 uppercase">{LANDING_COPY.registry.offlineRole}</span>
              </div>
            </div>

            <div className="bg-[#050b14] border border-white/8 rounded-xl p-4 text-center">
              <CheckCircle2 className="h-5 w-5 text-brand-teal mx-auto mb-2" />
              <p className="text-xs font-bold">{LANDING_COPY.registry.normalizer}</p>
              <p className="text-[9px] text-white/40 mt-1">{LANDING_COPY.registry.normalizerRole}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
