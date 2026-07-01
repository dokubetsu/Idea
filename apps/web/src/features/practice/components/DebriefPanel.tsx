import { Award, CheckCircle, XCircle, RotateCcw, Home, Scale } from "lucide-react";
import { DebriefResponse } from "../types";
import { Card, Button, Badge } from "@/shared/components/ui";

export function DebriefPanel({
  debrief,
  onRestart,
  onBackToHub,
}: {
  debrief: DebriefResponse;
  onRestart: () => void;
  onBackToHub: () => void;
}) {
  const { score, max_score, correct_count, decisions_count, decisions } = debrief;
  const percentage = max_score > 0 ? Math.round((score / max_score) * 100) : 0;
  const accuracy = decisions_count > 0 ? Math.round((correct_count / decisions_count) * 100) : 0;

  // SVG parameters for the progress circle
  const radius = 40;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Compile unique missed issue tags
  const missedIssues = Array.from(
    new Set(
      decisions
        .filter((d) => !d.is_correct && d.issue_tag)
        .map((d) => d.issue_tag)
    )
  );

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Score Summary Card */}
      <Card className="p-6 md:p-8 bg-gradient-to-br from-brand-blue-dark to-brand-blue-light text-brand-base-100 border-none shadow-xl relative overflow-hidden">
        <div className="absolute right-4 top-4 opacity-5">
          <Award className="w-48 h-48 text-white" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          {/* Circular Score Ring */}
          <div className="relative flex items-center justify-center">
            <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
              <circle
                stroke="rgba(255, 255, 255, 0.08)"
                fill="transparent"
                strokeWidth={stroke}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
              <circle
                stroke="#c9a84c"
                fill="transparent"
                strokeWidth={stroke}
                strokeDasharray={circumference + " " + circumference}
                style={{ strokeDashoffset }}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-bold font-serif text-brand-gold">{percentage}%</span>
              <span className="text-[8px] uppercase tracking-wider text-white/50">Score</span>
            </div>
          </div>

          {/* Metrics */}
          <div className="flex-1 text-center md:text-left space-y-3">
            <Badge tone="gold" className="text-[9px] font-bold">
              Practice Session Completed
            </Badge>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-white leading-tight">
              {debrief.scenario_title}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
              <div>
                <span className="text-[10px] block text-white/40 uppercase tracking-wider">
                  Total Score
                </span>
                <span className="text-lg font-bold text-brand-gold">
                  {score} / {max_score}
                </span>
              </div>
              <div>
                <span className="text-[10px] block text-white/40 uppercase tracking-wider">
                  Decision Accuracy
                </span>
                <span className="text-lg font-bold text-white">{accuracy}%</span>
              </div>
              <div className="col-span-2 md:col-span-1">
                <span className="text-[10px] block text-white/40 uppercase tracking-wider">
                  Decisions Count
                </span>
                <span className="text-lg font-bold text-white">
                  {correct_count} / {decisions_count} Correct
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Missed issues / recommendations */}
      {missedIssues.length > 0 && (
        <div className="p-5 rounded-xl border border-red-500/10 bg-red-500/5 text-red-800 space-y-3">
          <h4 className="text-sm font-bold text-red-600 uppercase tracking-wider">
            Critical Blind Spots Identified
          </h4>
          <p className="text-xs text-brand-blue-light/75">
            Your performance flagged accuracy gaps in the following legal principles. We recommend focusing on these topics:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {missedIssues.map((issue) => (
              <Badge key={issue} tone="red" className="text-[9px] font-semibold">
                {issue?.replace("_", " ")}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Decisions Log */}
      <div className="space-y-4">
        <h3 className="font-serif text-xl font-bold text-brand-blue-dark">
          Decision Log Details
        </h3>
        <div className="space-y-4">
          {decisions.map((dec, idx) => (
            <Card key={idx} className="p-5 space-y-3 border-brand-gold/8">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-brand-blue-light/40">
                    Step {idx + 1}: {dec.node_id.replace("_", " ")}
                  </span>
                  <p className="text-sm font-bold text-brand-blue-dark">
                    {dec.choice_text || "Input Value Submitted"}
                  </p>
                  {dec.input_value && (
                    <p className="text-xs text-brand-blue-light/60">
                      Input: <span className="font-semibold text-brand-blue-dark">{dec.input_value}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-brand-gold">
                    +{dec.score_awarded} pts
                  </span>
                  {dec.is_correct ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
              </div>

              {/* Feedback text */}
              <p className="text-xs text-brand-blue-light/75 leading-relaxed">
                {dec.feedback}
              </p>

              {/* Citation */}
              {dec.citation && (
                <div className="flex items-start gap-1.5 p-2 rounded bg-black/5 text-[11px] text-brand-blue-light/70">
                  <Scale className="w-3.5 h-3.5 text-brand-gold shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-brand-blue-dark">Source:</strong> {dec.citation}
                  </span>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Action Footer Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-black/5">
        <Button onClick={onRestart} variant="secondary" className="w-full sm:w-auto flex items-center gap-2">
          <RotateCcw className="w-4 h-4" />
          Practice Again
        </Button>
        <Button onClick={onBackToHub} variant="gold" className="w-full sm:w-auto flex items-center gap-2">
          <Home className="w-4 h-4" />
          Back to Hub
        </Button>
      </div>
    </div>
  );
}
