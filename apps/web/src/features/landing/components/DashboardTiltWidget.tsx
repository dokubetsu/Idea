"use client";

import { useRef, useState } from "react";
import { LANDING_COPY } from "@/app/landingCopy";

export function DashboardTiltWidget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tiltStyle, setTiltStyle] = useState({});

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Mouse relative coordinates from card center
    const mouseX = e.clientX - rect.left - width / 2;
    const mouseY = e.clientY - rect.top - height / 2;
    
    // Rotations (max 8 degrees)
    const rotateX = (-mouseY / (height / 2)) * 8;
    const rotateY = (mouseX / (width / 2)) * 8;
    
    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
      transition: "transform 0.1s ease-out"
    });
  };

  const handleMouseLeave = () => {
    setTiltStyle({
      transform: "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
      transition: "transform 0.5s ease-out"
    });
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={tiltStyle}
      className="max-w-4xl mx-auto rounded-2xl border border-white/10 bg-[#050b14]/75 shadow-2xl relative overflow-hidden p-6 cursor-pointer z-20"
    >
      {/* Gloss reflection layer */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 pointer-events-none" />

      {/* Mock Dashboard Layout */}
      <div className="space-y-6">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-white/8 pb-4">
          <div className="flex items-center gap-3">
            <span className="h-3.5 w-3.5 rounded-full bg-brand-gold/20 flex items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" />
            </span>
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-white">{LANDING_COPY.mockup.cardTitle}</h4>
              <p className="text-[9px] text-white/35">{LANDING_COPY.mockup.cardRef}</p>
            </div>
          </div>
          <span className="rounded-full border border-brand-teal/20 bg-brand-teal/10 px-2.5 py-0.5 text-[9px] font-bold text-brand-teal uppercase">Verified</span>
        </div>

        {/* Info Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-[#020509] border border-white/5 rounded-xl p-3.5 space-y-1.5">
            <p className="text-[9px] uppercase tracking-wider text-white/45">{LANDING_COPY.mockup.stat1Label}</p>
            <p className="text-sm font-bold text-white">{LANDING_COPY.mockup.stat1Val}</p>
            <span className="text-[8px] text-brand-teal font-semibold">{LANDING_COPY.mockup.stat1Sub}</span>
          </div>
          <div className="bg-[#020509] border border-white/5 rounded-xl p-3.5 space-y-1.5">
            <p className="text-[9px] uppercase tracking-wider text-white/45">{LANDING_COPY.mockup.stat2Label}</p>
            <p className="text-sm font-bold text-brand-gold">{LANDING_COPY.mockup.stat2Val}</p>
            <span className="text-[8px] text-white/40">{LANDING_COPY.mockup.stat2Sub}</span>
          </div>
          <div className="bg-[#020509] border border-white/5 rounded-xl p-3.5 space-y-1.5">
            <p className="text-[9px] uppercase tracking-wider text-white/45">{LANDING_COPY.mockup.stat3Label}</p>
            <p className="text-sm font-bold text-white">{LANDING_COPY.mockup.stat3Val}</p>
            <span className="text-[8px] text-brand-teal font-semibold">{LANDING_COPY.mockup.stat3Sub}</span>
          </div>
        </div>

        {/* Large Chart Area mockup */}
        <div className="bg-[#020509] border border-white/5 rounded-xl p-4 space-y-3">
          <p className="text-[9px] uppercase tracking-wider text-white/45">{LANDING_COPY.mockup.chartTitle}</p>
          <div className="h-16 flex items-end gap-1.5">
            <div className="w-full bg-brand-gold/15 h-[20%] rounded-md border border-brand-gold/25" />
            <div className="w-full bg-brand-gold/25 h-[45%] rounded-md border border-brand-gold/35" />
            <div className="w-full bg-brand-gold/35 h-[60%] rounded-md border border-brand-gold/45" />
            <div className="w-full bg-brand-gold/60 h-[80%] rounded-md border border-brand-gold/70" />
            <div className="w-full bg-brand-gold h-full rounded-md border border-brand-gold shadow-md shadow-brand-gold/10" />
          </div>
        </div>
      </div>
    </div>
  );
}
