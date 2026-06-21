"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { 
  Scale, ArrowRight, Clock, Sparkles, Cpu, FileText, 
  CheckCircle2, Activity, UserCheck, ChevronRight, AlertTriangle, 
  Database, Landmark, TrendingUp,
  Menu, X
} from "lucide-react";

// ─── Interfaces & Presets ──────────────────────────────────────────

interface FactItem {
  key: string;
  value: string;
  label: string;
  confidence: number;
}

interface PresetDemo {
  id: string;
  title: string;
  icon: React.ElementType;
  text: string;
  category: "cheque_bounce" | "rera";
  facts: FactItem[];
  timeline: { label: string; date: string; tone: "green" | "yellow" | "red" }[];
  draft: string;
  lawyer: { name: string; match: string; specialization: string; exp: string };
}

const PRESETS: PresetDemo[] = [
  {
    id: "cheque",
    title: "Section 138 Cheque Bounce",
    icon: Scale,
    text: "My cheque bounced yesterday due to insufficient funds. The cheque amount is 5 Lakhs, and the bank memo date was June 10, 2026.",
    category: "cheque_bounce",
    facts: [
      { key: "cheque_amount", value: "₹5,00,000", label: "Cheque Amount", confidence: 0.98 },
      { key: "dishonour_reason", value: "Funds Insufficient", label: "Dishonour Reason", confidence: 0.99 },
      { key: "dishonour_date", value: "2026-06-10", label: "Return Memo Date", confidence: 0.95 },
    ],
    timeline: [
      { label: "Cheque Presentation Window", date: "Within 90 days of issue (Valid)", tone: "green" },
      { label: "Demand Notice Deadline", date: "Before July 10, 2026 (Required)", tone: "yellow" },
      { label: "Grace Payment Window", date: "15 Days from Notice Receipt", tone: "green" },
      { label: "Court Filing Window", date: "30 Days from Grace Expiry", tone: "green" },
    ],
    draft: `# LEGAL NOTICE (SECTION 138 NI ACT)\n\nDate: 2026-06-11\n\nTo,\nOpponent (Drawer of Cheque)\n\nSUBJECT: DEMAND NOTICE FOR DISHONOUR OF CHEQUE NO. 998822 FOR ₹5,00,000\n\nDear Sir,\n\nUnder instructions from my client, I hereby serve you notice that Cheque No. 998822 dated 2026-05-15 for ₹5,00,000 drawn in favor of my client was returned unpaid on 2026-06-10 stating "Funds Insufficient".\n\nYou are hereby called upon to pay the said sum within 15 days of receipt of this notice, failing which criminal proceedings will be initiated.`,
    lawyer: {
      name: "Advocate Rajesh Kumar",
      match: "98% Match",
      specialization: "Negotiable Instruments Act, Delhi Court",
      exp: "12 yrs experience"
    }
  },
  {
    id: "rera",
    title: "RERA Delayed Possession",
    icon: Landmark,
    text: "My builder delayed possession of my flat. The promised date was Dec 31, 2025. I have paid a total of 30 Lakhs till date.",
    category: "rera",
    facts: [
      { key: "total_paid_amount", value: "₹30,00,000", label: "Total Amount Paid", confidence: 0.97 },
      { key: "promised_possession_date", value: "2025-12-31", label: "Promised Possession Date", confidence: 0.96 },
      { key: "delay_days", value: "162 Days Delayed", label: "Possession Delay", confidence: 0.98 },
    ],
    timeline: [
      { label: "Promised Possession Date", date: "December 31, 2025 (Breached)", tone: "red" },
      { label: "Delay Compensation Clock", date: "Accruing interest at 10.5% p.a.", tone: "yellow" },
      { label: "RERA Form M Filing Suit", date: "Active Limitation (3-Year window)", tone: "green" },
    ],
    draft: `# COMPLAINT TO REGULATORY AUTHORITY (FORM M)\n\nBEFORE THE REAL ESTATE REGULATORY AUTHORITY\n\nBetween:\nComplainant (Homebuyer)\nAnd\nRespondent (Builder / Promoter)\n\nParticulars of Complaint:\n- Unit Flat booked under Builder Sale Agreement.\n- Total paid amount: ₹30,00,000\n- Promised possession date: 2025-12-31\n- Total Delay: 162 days accrued.\n\nRelief Sought:\nDirections to the promoter to pay interest on delayed possession at the statutory rate (SBI MCLR + 2% per annum = 10.5%).`,
    lawyer: {
      name: "Advocate Smita Patil",
      match: "96% Match",
      specialization: "RERA & Real Estate, Maharashtra Court",
      exp: "9 yrs experience"
    }
  }
];

export default function RootPage() {
  // ─── Navbar & Menu States ────────────────────────────────────────
  const [scrollState, setScrollState] = useState<"top" | "pill" | "compact">("top");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      if (y < 80) {
        setScrollState("top");
      } else if (y >= 80 && y < 400) {
        setScrollState("pill");
      } else {
        setScrollState("compact");
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  // ─── Simulator Logic ─────────────────────────────────────────────
  const [activePresetId, setActivePresetId] = useState<string>("cheque");
  const [typedText, setTypedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [simStep, setSimStep] = useState<"idle" | "analyze" | "facts" | "timeline" | "draft" | "lawyer">("idle");
  const simulatorPreset = PRESETS.find(p => p.id === activePresetId) || PRESETS[0];

  const triggerSimulation = (presetId: string = activePresetId) => {
    const preset = PRESETS.find(p => p.id === presetId) || PRESETS[0];
    setActivePresetId(presetId);
    setSimStep("idle");
    setTypedText("");
    setIsTyping(true);

    // Typing simulation
    let index = 0;
    const interval = setInterval(() => {
      if (index < preset.text.length) {
        setTypedText((prev) => prev + preset.text.charAt(index));
        index++;
      } else {
        clearInterval(interval);
        setIsTyping(false);
        runWorkflowSteps();
      }
    }, 15);
  };

  const runWorkflowSteps = () => {
    setSimStep("analyze");
    setTimeout(() => {
      setSimStep("facts");
      setTimeout(() => {
        setSimStep("timeline");
        setTimeout(() => {
          setSimStep("draft");
          setTimeout(() => {
            setSimStep("lawyer");
          }, 1500);
        }, 1500);
      }, 1500);
    }, 1500);
  };

  useEffect(() => {
    // Initial trigger
    triggerSimulation("cheque");
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      {/* ─── Transforming Navbar ─────────────────────────────────────── */}
      <header
        className={`fixed left-0 right-0 z-50 transition-all duration-500 ease-in-out ${
          scrollState === "top"
            ? "top-0 py-6 bg-transparent border-b border-transparent"
            : scrollState === "pill"
            ? "top-4 max-w-5xl mx-auto px-6 py-3.5 glow-pill-border rounded-full left-4 right-4"
            : "top-0 py-3 bg-[#050b14]/90 backdrop-blur-md border-b border-white/10"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gold/15 border border-brand-gold/25">
              <Scale className="h-4 w-4 text-brand-gold" />
            </div>
            <span className="font-serif text-2xl font-bold tracking-tight text-white">
              LeAd
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-[13px] font-semibold tracking-wider uppercase text-white/60">
            <a href="#demo" className="hover:text-white transition-colors">Demo</a>
            <a href="#pipeline" className="hover:text-white transition-colors">Pipeline</a>
            <a href="#features" className="hover:text-white transition-colors">Capabilities</a>
            <a href="#registry" className="hover:text-white transition-colors">AI Registry</a>
            <a href="#stats" className="hover:text-white transition-colors">Metrics</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-[13px] font-bold text-white/70 hover:text-white px-4 py-2 transition-all"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="shimmer-btn rounded-full bg-brand-gold px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#050b14] hover:bg-brand-gold-light transition-all"
            >
              Start Free Journey
            </Link>
          </div>

          {/* Hamburger Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex md:hidden h-10 w-10 items-center justify-center rounded-xl border border-brand-gold/15 bg-brand-gold/8 text-brand-gold hover:bg-brand-gold/15 transition-all"
            aria-label="Open mobile navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ─── Section 1: Hero Section ─────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col justify-center items-center text-center px-4 sm:px-6 pt-32 lg:pt-24 z-20">
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
          {/* Tagline Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/20 bg-brand-gold/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-gold">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            <span>The Operating System for Legal Services</span>
          </div>

          {/* Hero Headline */}
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] text-white">
            Justice, <br />
            <span className="gold-text">reimagined</span> <br />
            for the AI era.
          </h1>

          {/* Subheading */}
          <p className="max-w-2xl mx-auto text-base md:text-xl text-white/55 font-medium leading-relaxed">
            One platform. One conversation. Everything legal. LeAd structures facts, verifies statutory timelines, and drafts compliant documents instantly.
          </p>

          {/* Call-to-actions */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
            <Link
              href="/register"
              className="shimmer-btn w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-brand-gold px-8 py-4 text-sm font-bold uppercase tracking-wider text-[#050b14] hover:bg-brand-gold-light hover:shadow-lg transition-all"
            >
              Start your journey <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#demo"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 py-4 text-sm font-bold uppercase tracking-wider text-white hover:bg-white/10 hover:border-white/20 transition-all"
            >
              Watch it think
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30 text-[10px] font-bold uppercase tracking-[0.2em] pointer-events-none">
          <span>Scroll to Explore</span>
          <div className="h-10 w-[1px] bg-gradient-to-b from-brand-gold/50 to-transparent animate-bounce mt-1" />
        </div>
      </section>

      {/* ─── Section 2: Try LeAd Simulator (AI Demo) ─────────────────── */}
      <section id="demo" className="py-16 md:py-24 px-4 sm:px-6 relative z-20 reveal-hidden">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">Interactive Sandbox</p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-white">Experience the logic loop.</h2>
            <p className="text-sm text-white/50">
              Select a statutory dispute scenario below and watch LeAd extract facts, calculate limits, and draft documents in real time.
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap justify-center gap-3 max-w-lg mx-auto">
            {PRESETS.map((preset) => {
              const IconComp = preset.icon;
              return (
                <button
                  key={preset.id}
                  onClick={() => triggerSimulation(preset.id)}
                  disabled={isTyping}
                  className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-5 rounded-full border text-xs font-bold uppercase tracking-wider transition-all duration-300 disabled:opacity-50 ${
                    activePresetId === preset.id
                      ? "bg-brand-gold border-brand-gold text-[#050b14] shadow-md shadow-brand-gold/10"
                      : "bg-[#050b14]/55 border-white/10 text-white/60 hover:bg-white/5"
                  }`}
                >
                  <IconComp className="h-4 w-4" /> {preset.title}
                </button>
              );
            })}
          </div>

          {/* Simulator Console Container */}
          <div className="grid gap-6 lg:grid-cols-2 max-w-5xl mx-auto">
            {/* Input Terminal */}
            <CardLayout title="Petitioner Statement Input" icon={Cpu}>
              <div className="space-y-4">
                <div className="bg-[#020509] border border-white/5 rounded-xl p-4 min-h-[160px] font-mono text-xs text-white/80 leading-relaxed relative overflow-hidden">
                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] uppercase tracking-wider text-emerald-500/80">Active</span>
                  </div>
                  {typedText}
                  {isTyping && <span className="inline-block w-1.5 h-4 bg-brand-gold animate-blink ml-0.5" />}
                </div>

                <div className="flex justify-between items-center text-[10px] text-white/40 font-mono">
                  <span>Typewriter Simulator active</span>
                  <span>{typedText.length} chars typed</span>
                </div>
              </div>
            </CardLayout>

            {/* AI Resolution Stack */}
            <CardLayout title="LeAd AI Output Pipeline" icon={Activity}>
              <div className="space-y-5 min-h-[360px] flex flex-col justify-between">
                {simStep === "idle" && (
                  <div className="flex-1 flex flex-col justify-center items-center text-center text-white/30 py-12">
                    <Activity className="h-10 w-10 animate-spin text-brand-gold/30 mb-2" />
                    <p className="text-xs">Waiting for user statement resolution...</p>
                  </div>
                )}

                {/* Step 1: Fact Extraction */}
                {(simStep === "analyze" || simStep === "facts" || simStep === "timeline" || simStep === "draft" || simStep === "lawyer") && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-brand-gold">Step 1: Fact Extraction</span>
                      {simStep === "analyze" ? (
                        <SpinnerSmall />
                      ) : (
                        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                      )}
                    </div>
                    {simStep !== "analyze" && (
                      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                        {simulatorPreset.facts.map((fact) => (
                          <div key={fact.key} className="bg-[#020509] border border-white/5 rounded-lg p-2.5">
                            <p className="text-[9px] uppercase tracking-wider text-white/45">{fact.label}</p>
                            <p className="text-xs font-bold text-white mt-0.5">{fact.value}</p>
                            <span className="text-[8px] text-brand-teal mt-0.5 block">{(fact.confidence * 100).toFixed(0)}% confidence</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Statutory Timeline Check */}
                {(simStep === "timeline" || simStep === "draft" || simStep === "lawyer") && (
                  <div className="space-y-2.5 pt-3 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-brand-gold">Step 2: Limitation & Deadlines</span>
                      {simStep === "timeline" ? <SpinnerSmall /> : <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />}
                    </div>
                    {simStep !== "timeline" && (
                      <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                        {simulatorPreset.timeline.map((item, idx) => (
                          <div key={idx} className="flex flex-col sm:flex-row sm:justify-between sm:items-center items-start gap-1.5 bg-[#020509] border border-white/5 rounded-lg p-2 text-xs">
                            <span className="text-white/60">{item.label}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              item.tone === "green" ? "bg-emerald-500/10 text-emerald-400" :
                              item.tone === "yellow" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"
                            }`}>{item.date}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Document Draft Preview */}
                {(simStep === "draft" || simStep === "lawyer") && (
                  <div className="space-y-2.5 pt-3 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-brand-gold">Step 3: Stamped Draft Notice</span>
                      {simStep === "draft" ? <SpinnerSmall /> : <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />}
                    </div>
                    {simStep !== "draft" && (
                      <div className="bg-[#fdfbf7] text-[#1a1a1a] rounded-lg p-3 max-h-[120px] overflow-y-auto font-serif text-[9px] leading-relaxed border-l-2 border-red-700/30 whitespace-pre-wrap">
                        {simulatorPreset.draft}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 4: Lawyer Matching */}
                {simStep === "lawyer" && (
                  <div className="space-y-2 pt-3 border-t border-brand-gold/15">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-brand-gold block">Step 4: Secure Counsel Match</span>
                    <div className="flex items-center gap-3 bg-[#020509] border border-brand-gold/20 rounded-xl p-3">
                      <div className="h-8 w-8 rounded-full bg-brand-gold/15 flex items-center justify-center text-brand-gold border border-brand-gold/30">
                        <UserCheck className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-white">{simulatorPreset.lawyer.name}</p>
                          <span className="text-[9px] font-bold text-brand-teal uppercase bg-brand-teal/10 px-2 py-0.5 rounded-full">{simulatorPreset.lawyer.match}</span>
                        </div>
                        <p className="text-[10px] text-white/50 truncate mt-0.5">{simulatorPreset.lawyer.specialization} · {simulatorPreset.lawyer.exp}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardLayout>
          </div>
        </div>
      </section>

      {/* ─── Section 3: Cinematic Problem-Solution ───────────────────── */}
      <section className="py-16 md:py-24 px-4 sm:px-6 relative z-20 reveal-hidden bg-brand-blue-dark/20 border-y border-white/5">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">Old Paradigm vs. Next Gen</p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-white">Replacing legal friction.</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Old World Card */}
            <div className="relative overflow-hidden rounded-2xl border border-red-500/10 bg-red-950/5 p-6 sm:p-8 space-y-5 transition-all duration-300 hover:border-red-500/20 group">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="font-serif text-xl font-bold text-red-400">The Traditional Process</h3>
              <ul className="space-y-3 font-mono text-xs text-white/40">
                <li className="flex items-center gap-2 text-red-350/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Phone calls & voicemail chases
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Fragmented folders and paper files
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Ambiguous limitation dates & calendars
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> High upfront costs with zero assessment certainty
                </li>
              </ul>
            </div>

            {/* Modern Card */}
            <div className="relative overflow-hidden rounded-2xl border border-brand-gold/15 bg-brand-gold/4 p-6 sm:p-8 space-y-5 transition-all duration-300 hover:border-brand-gold/30 group">
              <div className="h-10 w-10 rounded-xl bg-brand-gold/15 flex items-center justify-center text-brand-gold border border-brand-gold/30">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="font-serif text-xl font-bold text-brand-gold">The LeAd Paradigm</h3>
              <ul className="space-y-3 font-mono text-xs text-white/80">
                <li className="flex items-center gap-2 text-brand-teal">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-teal" /> Structured client-advocate conversation logs
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" /> Auto-compiled fact boards & draft generators
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" /> Automated statutory checker & alerts
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" /> Transparent budgets, key metrics, and registry fallbacks
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section 4: AI Pipeline Network Graph ─────────────────────── */}
      <section id="pipeline" className="py-16 md:py-24 px-4 sm:px-6 relative z-20 reveal-hidden">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">Processing Flow</p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-white">How LeAd structures legal claims.</h2>
            <p className="text-sm text-white/55">
              Claims flow through standard AI, mapping client inputs directly into verified, actionable databases.
            </p>
          </div>

          {/* Desktop SVG Pipeline */}
          <div className="hidden md:block w-full overflow-x-auto custom-scrollbar py-6">
            <div className="min-w-[800px] flex justify-between items-center relative py-6 px-10">
              {/* Connecting SVG Path Line */}
              <svg className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-8 z-0 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 50,4 H 750" stroke="rgba(201, 168, 76, 0.15)" strokeWidth="2" strokeDasharray="8" />
                <path d="M 50,4 H 750" stroke="#c9a84c" strokeWidth="2" className="svg-pipeline-path" fill="none" />
              </svg>

              <PipelineNode label="Conversation" desc="Voice or plain text" icon={Cpu} active />
              <PipelineNode label="Facts" desc="Extracted coordinates" icon={Database} active />
              <PipelineNode label="Validation" desc="Check limits & leaps" icon={Scale} active />
              <PipelineNode label="Workflow" desc="Build Form M / notices" icon={FileText} />
              <PipelineNode label="Assessment" desc="Risk probability metrics" icon={TrendingUp} />
              <PipelineNode label="Lawyer" desc="Matched secure CRM" icon={UserCheck} />
            </div>
          </div>

          {/* Mobile Stacked Pipeline */}
          <div className="flex md:hidden flex-col gap-8 relative py-4 pl-4">
            {/* Vertical Line */}
            <div className="absolute left-[40px] top-8 bottom-8 w-[2px] border-l border-dashed border-brand-gold/30 z-0" />
            
            <PipelineNodeVertical label="Conversation" desc="Voice or plain text" icon={Cpu} active />
            <PipelineNodeVertical label="Facts" desc="Extracted coordinates" icon={Database} active />
            <PipelineNodeVertical label="Validation" desc="Check limits & leaps" icon={Scale} active />
            <PipelineNodeVertical label="Workflow" desc="Build Form M / notices" icon={FileText} />
            <PipelineNodeVertical label="Assessment" desc="Risk probability metrics" icon={TrendingUp} />
            <PipelineNodeVertical label="Lawyer" desc="Matched secure CRM" icon={UserCheck} />
          </div>
        </div>
      </section>

      {/* ─── Section 5: 3D Mouse Tilt Dashboard Mockup ────────────────── */}
      <section className="py-16 md:py-24 px-4 sm:px-6 relative z-20 reveal-hidden">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">Next-Gen Interface</p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-white">The Operating Space.</h2>
            <p className="text-sm text-white/55">
              Hover your mouse over the interface mockup below to explore the responsive 3D dashboard visualization.
            </p>
          </div>

          <DashboardTiltWidget />
        </div>
      </section>

      {/* ─── Section 6: Capabilities Bento Grid ──────────────────────── */}
      <section id="features" className="py-16 md:py-24 px-4 sm:px-6 relative z-20 reveal-hidden">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">Platform Features</p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-white">Designed for high-impact legal CRM.</h2>
          </div>

          {/* Bento Grid */}
          <div className="grid gap-6 grid-cols-1 md:grid-cols-6 lg:grid-cols-3">
            <BentoCard
              colSpan="md:col-span-3 lg:col-span-1"
              title="Conversational AI Intake"
              desc="Transcribe and parse plain speech or documents, structuring facts automatically."
              icon={Cpu}
            />
            <BentoCard
              colSpan="md:col-span-3 lg:col-span-1"
              title="Vakalatnama & Stamped Drafts"
              desc="Instantly merge extracted databases with templates. Edit live inside our paper previewer."
              icon={FileText}
            />
            <BentoCard
              colSpan="md:col-span-3 lg:col-span-1"
              title="Statutory Calculators"
              desc="Calculate timelines for Section 138 bounce notices or delayed property possession interest."
              icon={Scale}
            />
            <BentoCard
              colSpan="md:col-span-3 lg:col-span-2"
              title="Interactive Limitation Timeline"
              desc="Track expiration deadlines (e.g. Order 37 CPC recovery limitation) with color-coded safety indicators."
              icon={Clock}
            />
            <BentoCard
              colSpan="md:col-span-3 lg:col-span-1"
              title="Matched Advocate Matching"
              desc="Pair matters with experienced legal experts based on specialization and ratings."
              icon={UserCheck}
            />
          </div>
        </div>
      </section>

      {/* ─── Section 7: AI Registry Router ───────────────────────────── */}
      <section id="registry" className="py-16 md:py-24 px-4 sm:px-6 relative z-20 reveal-hidden bg-brand-blue-dark/20 border-y border-white/5">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">Vendor Agnostic</p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-white">AI Provider Registry.</h2>
            <p className="text-sm text-white/50">
              LeAd routes prompt structures through a decoupled registry. Your legal data is never locked to a single AI vendor.
            </p>
          </div>

          {/* Registry Diagram Block */}
          <div className="max-w-3xl mx-auto bg-[#020509] border border-white/5 rounded-2xl p-5 sm:p-8 space-y-8 relative overflow-hidden">
            <div className="flex justify-between items-center relative z-10">
              <div className="space-y-1">
                <p className="text-xs font-bold text-white uppercase tracking-wider">AI Request Pipeline</p>
                <p className="text-[10px] text-white/45">Context Builder resolving models</p>
              </div>
              <span className="rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-0.5 text-[9px] font-bold text-brand-gold">ACTIVE PIPELINE</span>
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
                    <span className="text-xs font-bold text-white">Google Gemini</span>
                  </div>
                  <span className="text-[8px] text-brand-gold uppercase font-bold">Primary</span>
                </div>
                <div className="flex items-center justify-between bg-white/5 border border-white/8 rounded-xl p-3 opacity-60">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-white/20" />
                    <span className="text-xs font-bold text-white">Anthropic Claude</span>
                  </div>
                  <span className="text-[8px] text-white/40 uppercase">Secondary Fallback</span>
                </div>
                <div className="flex items-center justify-between bg-white/5 border border-white/8 rounded-xl p-3 opacity-60">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-white/20" />
                    <span className="text-xs font-bold text-white">Local Ollama / vLLM</span>
                  </div>
                  <span className="text-[8px] text-white/40 uppercase">Offline Node</span>
                </div>
              </div>

              <div className="bg-[#050b14] border border-white/8 rounded-xl p-4 text-center">
                <CheckCircle2 className="h-5 w-5 text-brand-teal mx-auto mb-2" />
                <p className="text-xs font-bold">Normalizer</p>
                <p className="text-[9px] text-white/40 mt-1">Validated output</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section 8: Metrics Counter ──────────────────────────────── */}
      <section id="stats" className="py-16 md:py-24 px-4 sm:px-6 relative z-20 reveal-hidden">
        <div className="max-w-5xl mx-auto grid gap-8 md:grid-cols-3 text-center">
          <MetricWidget value={15} suffix="k+" label="Advocate Hours Saved" />
          <MetricWidget value={98} suffix="%" label="Assessment Accuracy" />
          <MetricWidget value={1} suffix="" label="Conversation to Case File" />
        </div>
      </section>

      {/* ─── Section 9: Testimonials Placeholder (Sleek Beta Strip) ──── */}
      <section className="py-16 md:py-24 px-4 sm:px-6 relative z-20 reveal-hidden max-w-4xl mx-auto text-center space-y-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">Beta Access Program</p>
        <blockquote className="font-serif text-2xl md:text-3xl font-medium text-white/85 leading-relaxed">
          "LeAd's AI extracted facts and mapped dates correctly. The Vakalatnama populated instantly with my RERA claims."
        </blockquote>
        <p className="text-xs text-brand-gold font-mono uppercase tracking-wider">— Petitioner, Maharashtra Property Dispute</p>
      </section>

      {/* ─── Section 10: Immersive CTA ───────────────────────────────── */}
      <section className="min-h-screen flex flex-col justify-center items-center text-center px-4 sm:px-6 relative z-20 reveal-hidden">
        <div className="max-w-4xl mx-auto space-y-8">
          <h2 className="font-serif text-5xl md:text-7xl font-bold tracking-tight text-white leading-tight">
            Justice shouldn't depend <br />
            on knowing where to start.
          </h2>

          <div className="pt-6">
            <Link
              href="/register"
              className="shimmer-btn inline-flex items-center gap-3 rounded-full bg-brand-gold px-8 py-4 text-sm font-bold uppercase tracking-wider text-[#050b14] hover:bg-brand-gold-light hover:shadow-lg transition-all"
            >
              Start your free journey <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 text-center text-xs text-white/30 font-mono relative z-20">
        <p>© 2026 LeAd · Privacy Policy · Terms of Service · Indian Legal Tech OS</p>
      </footer>

      {isMobileMenuOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#050b14]/70 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-[#050b14]/95 border-r border-white/5 p-6 text-white shadow-2xl transition-transform duration-300">
            {/* Close Button */}
            <div className="absolute right-4 top-4">
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/50 hover:bg-white/5 hover:text-white"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Logo */}
            <div className="flex items-center gap-3 border-b border-white/8 pb-5 pt-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gold/15 border border-brand-gold/25">
                <Scale className="h-4 w-4 text-brand-gold" />
              </div>
              <span className="font-serif text-2xl font-bold tracking-tight">LeAd</span>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 space-y-2 overflow-y-auto py-8">
              <a
                href="#demo"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block rounded-xl px-4 py-3 text-sm font-semibold tracking-wide uppercase text-white/70 hover:bg-white/5 hover:text-white transition-all"
              >
                Demo
              </a>
              <a
                href="#pipeline"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block rounded-xl px-4 py-3 text-sm font-semibold tracking-wide uppercase text-white/70 hover:bg-white/5 hover:text-white transition-all"
              >
                Pipeline
              </a>
              <a
                href="#features"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block rounded-xl px-4 py-3 text-sm font-semibold tracking-wide uppercase text-white/70 hover:bg-white/5 hover:text-white transition-all"
              >
                Capabilities
              </a>
              <a
                href="#registry"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block rounded-xl px-4 py-3 text-sm font-semibold tracking-wide uppercase text-white/70 hover:bg-white/5 hover:text-white transition-all"
              >
                AI Registry
              </a>
              <a
                href="#stats"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block rounded-xl px-4 py-3 text-sm font-semibold tracking-wide uppercase text-white/70 hover:bg-white/5 hover:text-white transition-all"
              >
                Metrics
              </a>
            </nav>

            {/* CTAs */}
            <div className="border-t border-white/8 pt-6 space-y-3">
              <Link
                href="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex w-full items-center justify-center rounded-xl border border-white/10 py-3 text-xs font-bold uppercase tracking-wider text-white/70 hover:bg-white/5 hover:text-white transition-all"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                onClick={() => setIsMobileMenuOpen(false)}
                className="shimmer-btn flex w-full items-center justify-center rounded-xl bg-brand-gold py-3 text-xs font-bold uppercase tracking-wider text-[#050b14] hover:bg-brand-gold-light transition-all"
              >
                Start Free Journey
              </Link>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Sub-Components ────────────────────────────────────────────────

function CardLayout({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#050b14]/65 backdrop-blur-md p-6 space-y-4">
      <div className="flex items-center gap-2 border-b border-white/5 pb-3">
        <Icon className="h-4.5 w-4.5 text-brand-gold" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/80">{title}</h3>
      </div>
      {children}
    </div>
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
    <div className="flex items-center gap-5 relative z-10 group">
      <div className={`h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
        active 
          ? "bg-brand-gold border-brand-gold text-[#050b14] shadow-md shadow-brand-gold/15" 
          : "bg-[#020509] border-white/10 text-white/40 group-hover:border-white/20"
      }`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-left">
        <p className={`text-sm font-bold ${active ? "text-white" : "text-white/45"}`}>{label}</p>
        <p className="text-[11px] text-white/40 mt-0.5 max-w-[220px] leading-snug">{desc}</p>
      </div>
    </div>
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

function SpinnerSmall() {
  return (
    <div className="h-4.5 w-4.5 rounded-full border-2 border-brand-gold/20 border-t-brand-gold animate-spin" />
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

function DashboardTiltWidget() {
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
      className="max-w-4xl mx-auto rounded-2xl border border-white/10 bg-[#050b14]/75 shadow-2xl relative overflow-hidden p-6 cursor-pointer"
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
              <h4 className="text-xs font-bold text-white">Active Matter: Summary Suit Recovery</h4>
              <p className="text-[9px] text-white/35">Case reference: NY-99881-CB</p>
            </div>
          </div>
          <span className="rounded-full border border-brand-teal/20 bg-brand-teal/10 px-2.5 py-0.5 text-[9px] font-bold text-brand-teal uppercase">Verified</span>
        </div>

        {/* Info Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-[#020509] border border-white/5 rounded-xl p-3.5 space-y-1.5">
            <p className="text-[9px] uppercase tracking-wider text-white/45">Filing Deadline</p>
            <p className="text-sm font-bold text-white">June 20, 2027</p>
            <span className="text-[8px] text-brand-teal font-semibold">365 Days Remaining</span>
          </div>
          <div className="bg-[#020509] border border-white/5 rounded-xl p-3.5 space-y-1.5">
            <p className="text-[9px] uppercase tracking-wider text-white/45">Estimated Court Fees</p>
            <p className="text-sm font-bold text-brand-gold">₹8,500.00</p>
            <span className="text-[8px] text-white/40">Delhi State Schedule scale</span>
          </div>
          <div className="bg-[#020509] border border-white/5 rounded-xl p-3.5 space-y-1.5">
            <p className="text-[9px] uppercase tracking-wider text-white/45">RERA Delay Interest</p>
            <p className="text-sm font-bold text-white">10.5% p.a.</p>
            <span className="text-[8px] text-brand-teal font-semibold">SBI MCLR + 2.0%</span>
          </div>
        </div>

        {/* Large Chart Area mockup */}
        <div className="bg-[#020509] border border-white/5 rounded-xl p-4 space-y-3">
          <p className="text-[9px] uppercase tracking-wider text-white/45">Case Progress Pipeline</p>
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
