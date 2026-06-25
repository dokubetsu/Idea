"use client";

import { Cpu, FileText, Scale, Clock, UserCheck } from "lucide-react";
import { LANDING_COPY } from "@/app/landingCopy";

export function CapabilitiesSection() {
  return (
    <section id="features" className="py-16 md:py-24 px-4 sm:px-6 relative z-20 reveal-hidden">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">{LANDING_COPY.features.badge}</p>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-white">{LANDING_COPY.features.title}</h2>
        </div>

        {/* Bento Grid */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-6 lg:grid-cols-3">
          <BentoCard
            colSpan="md:col-span-3 lg:col-span-1"
            title={LANDING_COPY.features.cards[0].title}
            desc={LANDING_COPY.features.cards[0].desc}
            icon={Cpu}
          />
          <BentoCard
            colSpan="md:col-span-3 lg:col-span-1"
            title={LANDING_COPY.features.cards[1].title}
            desc={LANDING_COPY.features.cards[1].desc}
            icon={FileText}
          />
          <BentoCard
            colSpan="md:col-span-3 lg:col-span-1"
            title={LANDING_COPY.features.cards[2].title}
            desc={LANDING_COPY.features.cards[2].desc}
            icon={Scale}
          />
          <BentoCard
            colSpan="md:col-span-3 lg:col-span-2"
            title={LANDING_COPY.features.cards[3].title}
            desc={LANDING_COPY.features.cards[3].desc}
            icon={Clock}
          />
          <BentoCard
            colSpan="md:col-span-3 lg:col-span-1"
            title={LANDING_COPY.features.cards[4].title}
            desc={LANDING_COPY.features.cards[4].desc}
            icon={UserCheck}
          />
        </div>
      </div>
    </section>
  );
}

function BentoCard({ colSpan, title, desc, icon: Icon }: { colSpan: string; title: string; desc: string; icon: React.ElementType }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[#050b14]/65 backdrop-blur-md p-6 space-y-3 transition-all duration-300 hover:border-brand-gold/30 hover:-translate-y-1 hover:shadow-md hover:shadow-brand-gold/2 ${colSpan} group`}>
      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-brand-gold/2 rounded-full blur-xl pointer-events-none group-hover:bg-brand-gold/5 transition-all" />
      <div className="h-9 w-9 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold border border-brand-gold/20">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <h3 className="font-serif text-lg font-bold text-white">{title}</h3>
      <p className="text-xs text-white/55 leading-relaxed">{desc}</p>
    </div>
  );
}
