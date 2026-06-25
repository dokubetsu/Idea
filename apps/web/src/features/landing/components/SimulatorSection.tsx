"use client";

import { useState, useEffect } from "react";
import { Cpu, Activity, CheckCircle2, UserCheck, Scale, Landmark } from "lucide-react";
import { LANDING_COPY } from "@/app/landingCopy";

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
    title: "Cheque Bounce (Section 138)",
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
    title: "Delayed Home Possession (RERA)",
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

export function SimulatorSection() {
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
    triggerSimulation("cheque");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section id="demo" className="py-16 md:py-24 px-4 sm:px-6 relative z-20 reveal-hidden">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">{LANDING_COPY.demo.badge}</p>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-white">{LANDING_COPY.demo.title}</h2>
          <p className="text-sm text-white/50">
            {LANDING_COPY.demo.subheading}
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
          <CardLayout title={LANDING_COPY.demo.inputCardTitle} icon={Cpu}>
            <div className="space-y-4">
              <div className="bg-[#020509] border border-white/5 rounded-xl p-4 min-h-[160px] font-mono text-xs text-white/80 leading-relaxed relative overflow-hidden break-words whitespace-pre-wrap">
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
          <CardLayout title={LANDING_COPY.demo.outputCardTitle} icon={Activity}>
            <div className="space-y-5 min-h-[360px] flex flex-col justify-between">
              {simStep === "idle" && (
                <div className="flex-1 flex flex-col justify-center items-center text-center text-white/30 py-12">
                  <Activity className="h-10 w-10 animate-spin text-brand-gold/30 mb-2" />
                  <p className="text-xs">Waiting for case details resolution...</p>
                </div>
              )}

              {/* Step 1: Fact Extraction */}
              {(simStep === "analyze" || simStep === "facts" || simStep === "timeline" || simStep === "draft" || simStep === "lawyer") && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-brand-gold">{LANDING_COPY.demo.steps.step1}</span>
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
                    <span className="text-[10px] uppercase tracking-wider font-bold text-brand-gold">{LANDING_COPY.demo.steps.step2}</span>
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
                    <span className="text-[10px] uppercase tracking-wider font-bold text-brand-gold">{LANDING_COPY.demo.steps.step3}</span>
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
                  <span className="text-[10px] uppercase tracking-wider font-bold text-brand-gold block">{LANDING_COPY.demo.steps.step4}</span>
                  <div className="flex items-center gap-3 bg-[#020509] border border-brand-gold/20 rounded-xl p-3 w-full overflow-hidden">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-brand-gold/15 flex items-center justify-center text-brand-gold border border-brand-gold/30">
                      <UserCheck className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-white truncate">{simulatorPreset.lawyer.name}</p>
                        <span className="text-[9px] shrink-0 font-bold text-brand-teal uppercase bg-brand-teal/10 px-2 py-0.5 rounded-full">{simulatorPreset.lawyer.match}</span>
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
  );
}

function CardLayout({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#050b14]/65 backdrop-blur-md p-4 sm:p-6 space-y-4 w-full overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/5 pb-3">
        <Icon className="h-4.5 w-4.5 text-brand-gold shrink-0" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/80 truncate">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function SpinnerSmall() {
  return (
    <div className="h-4.5 w-4.5 rounded-full border-2 border-brand-gold/20 border-t-brand-gold animate-spin" />
  );
}
