"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Scale, Menu, X } from "lucide-react";
import { LANDING_COPY } from "@/app/landingCopy";

export function Navbar() {
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

  return (
    <>
      <header
        className={`fixed left-0 right-0 z-50 transition-all duration-500 ease-in-out ${
          scrollState === "top"
            ? "top-0 py-6 bg-transparent border-b border-transparent px-6"
            : scrollState === "pill"
            ? "top-4 max-w-5xl mx-auto px-6 py-3.5 glow-pill-border rounded-full left-4 right-4"
            : "top-0 py-3 bg-[#050b14]/90 backdrop-blur-md border-b border-white/10 px-6"
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
    </>
  );
}
