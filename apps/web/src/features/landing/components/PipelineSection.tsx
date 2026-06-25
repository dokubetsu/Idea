"use client";

import { Cpu, Database, Scale, FileText, TrendingUp, UserCheck } from "lucide-react";
import { LANDING_COPY } from "@/app/landingCopy";

export function PipelineSection() {
  return (
    <section id="pipeline" className="py-16 md:py-24 px-4 sm:px-6 relative z-20 reveal-hidden">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">{LANDING_COPY.pipeline.badge}</p>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-white">{LANDING_COPY.pipeline.title}</h2>
          <p className="text-sm text-white/55">
            {LANDING_COPY.pipeline.subheading}
          </p>
        </div>

        {/* Desktop SVG Pipeline */}
        <div className="hidden md:block w-full overflow-x-auto custom-scrollbar py-6">
          <div className="min-w-[800px] flex justify-between items-center relative py-6 px-10">
            {/* Connecting SVG Path Line */}
            <svg className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-8 z-0 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <path d="M 50,4 H 750" stroke="rgba(201, 168, 76, 0.15)" strokeWidth="2" strokeDasharray="8" fill="none" />
              <path d="M 50,4 H 750" stroke="#c9a84c" strokeWidth="2" className="svg-pipeline-path" fill="none" />
            </svg>

            <PipelineNode label={LANDING_COPY.pipeline.nodes[0].label} desc={LANDING_COPY.pipeline.nodes[0].desc} icon={Cpu} active />
            <PipelineNode label={LANDING_COPY.pipeline.nodes[1].label} desc={LANDING_COPY.pipeline.nodes[1].desc} icon={Database} active />
            <PipelineNode label={LANDING_COPY.pipeline.nodes[2].label} desc={LANDING_COPY.pipeline.nodes[2].desc} icon={Scale} active />
            <PipelineNode label={LANDING_COPY.pipeline.nodes[3].label} desc={LANDING_COPY.pipeline.nodes[3].desc} icon={FileText} />
            <PipelineNode label={LANDING_COPY.pipeline.nodes[4].label} desc={LANDING_COPY.pipeline.nodes[4].desc} icon={TrendingUp} />
            <PipelineNode label={LANDING_COPY.pipeline.nodes[5].label} desc={LANDING_COPY.pipeline.nodes[5].desc} icon={UserCheck} />
          </div>
        </div>

        {/* Mobile Stacked Pipeline */}
        <div className="flex md:hidden flex-col gap-8 relative py-4 pl-4 w-full">
          {/* Vertical Line */}
          <div className="absolute left-[40px] top-8 bottom-8 w-[2px] border-l border-dashed border-brand-gold/30 z-0" />
          
          <PipelineNodeVertical label={LANDING_COPY.pipeline.nodes[0].label} desc={LANDING_COPY.pipeline.nodes[0].desc} icon={Cpu} active />
          <PipelineNodeVertical label={LANDING_COPY.pipeline.nodes[1].label} desc={LANDING_COPY.pipeline.nodes[1].desc} icon={Database} active />
          <PipelineNodeVertical label={LANDING_COPY.pipeline.nodes[2].label} desc={LANDING_COPY.pipeline.nodes[2].desc} icon={Scale} active />
          <PipelineNodeVertical label={LANDING_COPY.pipeline.nodes[3].label} desc={LANDING_COPY.pipeline.nodes[3].desc} icon={FileText} />
          <PipelineNodeVertical label={LANDING_COPY.pipeline.nodes[4].label} desc={LANDING_COPY.pipeline.nodes[4].desc} icon={TrendingUp} />
          <PipelineNodeVertical label={LANDING_COPY.pipeline.nodes[5].label} desc={LANDING_COPY.pipeline.nodes[5].desc} icon={UserCheck} />
        </div>
      </div>
    </section>
  );
}

function PipelineNode({ label, desc, icon: Icon, active = false }: { label: string; desc: string; icon: React.ElementType; active?: boolean }) {
  return (
    <div className="flex flex-col items-center text-center relative z-10 space-y-2 group">
      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
        active 
          ? "bg-brand-gold border-brand-gold text-[#050b14] shadow-md shadow-brand-gold/15" 
          : "bg-[#020509] border-white/10 text-white/40 group-hover:border-white/20"
      }`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className={`text-xs font-bold ${active ? "text-white" : "text-white/45"}`}>{label}</p>
        <p className="text-[9px] text-white/30 mt-0.5 max-w-[110px] leading-tight">{desc}</p>
      </div>
    </div>
  );
}

function PipelineNodeVertical({ label, desc, icon: Icon, active = false }: { label: string; desc: string; icon: React.ElementType; active?: boolean }) {
  return (
    <div className="flex items-center gap-4 sm:gap-5 relative z-10 group w-full">
      <div className={`h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
        active 
          ? "bg-brand-gold border-brand-gold text-[#050b14] shadow-md shadow-brand-gold/15" 
          : "bg-[#020509] border-white/10 text-white/40 group-hover:border-white/20"
      }`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-left flex-1 min-w-0">
        <p className={`text-sm font-bold truncate ${active ? "text-white" : "text-white/45"}`}>{label}</p>
        <p className="text-[11px] text-white/40 mt-0.5 leading-snug break-words">{desc}</p>
      </div>
    </div>
  );
}
