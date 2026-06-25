"use client";

import { useEffect } from "react";
import { Navbar } from "@/features/landing/components/Navbar";
import { HeroSection } from "@/features/landing/components/HeroSection";
import { SimulatorSection } from "@/features/landing/components/SimulatorSection";
import { CinematicCompare } from "@/features/landing/components/CinematicCompare";
import { PipelineSection } from "@/features/landing/components/PipelineSection";
import { DashboardTiltWidget } from "@/features/landing/components/DashboardTiltWidget";
import { CapabilitiesSection } from "@/features/landing/components/CapabilitiesSection";
import { AIRegistrySection } from "@/features/landing/components/AIRegistrySection";
import { StatsSection } from "@/features/landing/components/StatsSection";
import { LandingFooter } from "@/features/landing/components/LandingFooter";
import { LANDING_COPY } from "./landingCopy";

export default function RootPage() {
  // ─── Scroll Reveal Observer ──────────────────────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
          }
        });
      },
      { threshold: 0.15 }
    );

    const hiddenElements = document.querySelectorAll(".reveal-hidden");
    hiddenElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="dark-canvas min-h-screen relative font-sans selection:bg-brand-gold/30 selection:text-white overflow-x-hidden">
      {/* Background Grids & Orbs */}
      <div className="absolute inset-0 legal-grid opacity-70 pointer-events-none z-0" />
      <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] orb-gold rounded-full pointer-events-none z-0" />
      <div className="absolute top-[40%] right-[10%] w-[600px] h-[600px] orb-blue rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-[10%] left-[20%] w-[500px] h-[500px] orb-gold rounded-full pointer-events-none z-0" />

      {/* Floating particles noise overlay */}
      <div className="fixed inset-0 grain pointer-events-none z-10" />

      {/* Transforming Navbar */}
      <Navbar />

      {/* Hero Section */}
      <HeroSection />

      {/* Try LeAd Simulator (AI Demo) */}
      <SimulatorSection />

      {/* Cinematic Problem-Solution Comparison */}
      <CinematicCompare />

      {/* AI Pipeline Network Graph */}
      <PipelineSection />

      {/* Immersive Dashboard Mockup Section */}
      <section className="py-16 md:py-24 px-4 sm:px-6 relative z-20 reveal-hidden">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">{LANDING_COPY.mockup.badge}</p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-white">{LANDING_COPY.mockup.title}</h2>
            <p className="text-sm text-white/55">
              {LANDING_COPY.mockup.subheading}
            </p>
          </div>

          <DashboardTiltWidget />
        </div>
      </section>

      {/* Capabilities Bento Grid */}
      <CapabilitiesSection />

      {/* AI Registry Router */}
      <AIRegistrySection />

      {/* Metrics Counters */}
      <StatsSection />

      {/* Testimonial & Footer Footer */}
      <LandingFooter />
    </div>
  );
}
