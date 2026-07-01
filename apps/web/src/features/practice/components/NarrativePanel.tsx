import { Scale } from "lucide-react";
import { DarkCard } from "@/shared/components/ui";

export function NarrativePanel({ text }: { text: string }) {
  return (
    <DarkCard className="relative p-6 md:p-8 animate-fade-in-up">
      {/* Decorative gavel icon in the corner */}
      <div className="absolute right-4 top-4 opacity-10">
        <Scale className="w-24 h-24 text-white" />
      </div>

      <div className="relative z-10 space-y-4">
        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-brand-gold">
          Case Scenario Facts
        </span>
        <p className="font-serif text-lg md:text-xl leading-relaxed text-brand-base-100/90 whitespace-pre-wrap">
          {text}
        </p>
      </div>
    </DarkCard>
  );
}
