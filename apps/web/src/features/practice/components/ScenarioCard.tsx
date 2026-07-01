import { useRouter } from "next/navigation";
import { BookOpen, Clock } from "lucide-react";
import { useStartSession } from "../hooks/usePractice";
import { ScenarioSummary } from "../types";
import { Card, Badge, Button } from "@/shared/components/ui";

export function ScenarioCard({
  scenario,
  role,
}: {
  scenario: ScenarioSummary;
  role: "user" | "lawyer";
}) {
  const router = useRouter();
  const startSessionMutation = useStartSession();

  const handleStart = () => {
    startSessionMutation.mutate(scenario.scenario_key, {
      onSuccess: (data) => {
        router.push(`/${role}/practice/${data.id}`);
      },
    });
  };

  const difficultyTone = {
    beginner: "teal" as const,
    intermediate: "gold" as const,
    advanced: "red" as const,
  }[scenario.difficulty] || ("gold" as const);

  return (
    <Card hover className="flex flex-col h-full">
      <div className="flex-1 p-5 space-y-4">
        {/* Domain and Difficulty */}
        <div className="flex items-center justify-between gap-2">
          <Badge tone="teal" className="text-[10px] font-bold">
            {scenario.domain}
          </Badge>
          <Badge tone={difficultyTone} className="text-[10px] font-bold">
            {scenario.difficulty}
          </Badge>
        </div>

        {/* Title */}
        <div>
          <h3 className="font-serif text-lg font-bold text-brand-blue-dark line-clamp-2">
            {scenario.title}
          </h3>
          {scenario.based_on && (
            <p className="mt-1 text-[11px] text-brand-blue-light/50 line-clamp-1">
              Based on: {scenario.based_on}
            </p>
          )}
        </div>

        {/* Info */}
        <div className="flex items-center gap-4 text-xs text-brand-blue-light/70 pt-2 border-t border-black/5">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-brand-gold" />
            <span>{scenario.estimated_minutes} mins</span>
          </div>
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-brand-teal" />
            <span>v{scenario.version}</span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {scenario.tags.map((tag) => (
            <span
              key={tag}
              className="text-[9px] bg-brand-blue-dark/5 text-brand-blue-light/60 px-2 py-0.5 rounded-full border border-black/5"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Action Button */}
      <div className="p-5 pt-0">
        <Button
          onClick={handleStart}
          disabled={startSessionMutation.isPending}
          variant="gold"
          className="w-full"
        >
          {startSessionMutation.isPending ? "Starting..." : "Start Practice"}
        </Button>
      </div>
    </Card>
  );
}
