import { CheckCircle2, AlertOctagon, Scale } from "lucide-react";
import { Button } from "@/shared/components/ui";

export function DecisionFeedback({
  isCorrect,
  scoreAwarded,
  feedback,
  citation,
  onContinue,
}: {
  isCorrect: boolean;
  scoreAwarded: number;
  feedback: string;
  citation: string | null;
  onContinue: () => void;
}) {
  return (
    <div
      className={`p-6 rounded-xl border flex flex-col md:flex-row gap-5 shadow-lg items-start transition-all duration-300 ${
        isCorrect
          ? "border-green-500/20 bg-green-500/5 text-green-800 shadow-green-500/5 animate-glow-pulse"
          : "border-red-500/20 bg-red-500/5 text-red-800 shadow-red-500/5 animate-shake"
      }`}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {isCorrect ? (
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        ) : (
          <AlertOctagon className="w-10 h-10 text-red-500" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-3">
          <span
            className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
              isCorrect
                ? "bg-green-500/20 text-green-600"
                : "bg-red-500/20 text-red-600"
            }`}
          >
            {isCorrect ? "Correct Decision" : "Incorrect Decision"}
          </span>
          {scoreAwarded !== 0 ? (
            <span
              className={`text-xs font-bold ${
                scoreAwarded > 0 ? "text-brand-gold" : "text-red-500"
              }`}
            >
              {scoreAwarded > 0 ? `+${scoreAwarded}` : scoreAwarded} Points
            </span>
          ) : (
            <span className="text-xs font-bold text-brand-blue-light/50">
              No points awarded
            </span>
          )}
        </div>

        <p className="text-sm font-semibold leading-relaxed animate-fade-in-up text-brand-blue-dark">
          {feedback}
        </p>

        {citation && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-black/5 border border-black/5 animate-fade-in-up text-xs text-brand-blue-light/75">
            <Scale className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-brand-blue-dark mb-0.5">
                Statutory Citation:
              </span>
              <span className="italic">{citation}</span>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={onContinue} variant="gold">
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
