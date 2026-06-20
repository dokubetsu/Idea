"use client";
import { useState, useEffect } from "react";
import { X, Play, BookOpen, Users, FileText, ChevronRight, Check } from "lucide-react";
import { Button } from "./index";

export function QuickStartGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Only show once per session or use localStorage to persist dismissal
    const dismissed = localStorage.getItem("lead_quickstart_dismissed");
    if (!dismissed) {
      // delay a bit before showing
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("lead_quickstart_dismissed", "true");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const steps = [
    {
      title: "Welcome to LeAd!",
      desc: "Your AI-powered Legal Advisor. Let's take a quick tour of how the platform helps you resolve your legal issues faster and more transparently.",
      icon: <Play className="h-10 w-10 text-brand-gold animate-pulse" />
    },
    {
      title: "1. AI Case Intake",
      desc: "Start by chatting with our AI in natural language. We'll extract the key facts, assess the legal standing, and prepare a structured brief for lawyers.",
      icon: <BookOpen className="h-10 w-10 text-brand-teal" />
    },
    {
      title: "2. Match with Experts",
      desc: "Once your brief is ready, you can browse verified advocates by specialization, request a consultation, and securely hire them directly through the platform.",
      icon: <Users className="h-10 w-10 text-brand-gold" />
    },
    {
      title: "3. Track & Collaborate",
      desc: "Monitor upcoming court hearings, securely share files in your Document Vault, and pay for transparent milestones as your case progresses.",
      icon: <FileText className="h-10 w-10 text-brand-teal" />
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-blue-dark/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-base-100 rounded-2xl shadow-2xl border border-brand-gold/20 overflow-hidden m-4 animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-gold/10 bg-brand-gold/5">
          <h2 className="font-serif text-xl font-bold text-brand-blue-dark">Quick Start Guide & Demo</h2>
          <button onClick={handleDismiss} className="p-1 hover:bg-brand-gold/20 rounded-full transition-colors">
            <X className="h-5 w-5 text-brand-blue-light/70" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-brand-gold/10 rounded-full mb-2">
            {steps[step].icon}
          </div>
          <h3 className="font-serif text-2xl font-bold text-brand-blue-dark">{steps[step].title}</h3>
          <p className="text-brand-blue-light/80 text-sm leading-relaxed h-16">
            {steps[step].desc}
          </p>
        </div>

        {/* Footer / Controls */}
        <div className="px-6 py-5 bg-base-200/50 border-t border-brand-gold/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-brand-gold' : 'w-2 bg-brand-gold/30'}`} 
              />
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-brand-blue-light/60">
              Skip
            </Button>
            
            {step < steps.length - 1 ? (
              <Button variant="secondary" size="sm" onClick={() => setStep(step + 1)}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={handleDismiss}>
                Get Started <Check className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
