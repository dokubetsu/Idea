import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Award } from "lucide-react";
import {
  useSession,
  useSubmitDecision,
  useDebrief,
  useStartSession,
} from "../hooks/usePractice";
import { ProgressBar } from "./ProgressBar";
import { NarrativePanel } from "./NarrativePanel";
import { ChoiceCard } from "./ChoiceCard";
import { InputNode } from "./InputNode";
import { DecisionFeedback } from "./DecisionFeedback";
import { DebriefPanel } from "./DebriefPanel";
import { Button } from "@/shared/components/ui";
import { DecisionResponse } from "../types";

export function SessionView({
  sessionId,
  role,
}: {
  sessionId: string;
  role: "user" | "lawyer";
}) {
  const router = useRouter();

  // Load session
  const { data: session, isLoading: sessionLoading, error: sessionError } = useSession(sessionId);

  // Load debrief if completed
  const isCompleted = session?.status === "completed";
  const { data: debrief, isLoading: debriefLoading } = useDebrief(
    isCompleted ? sessionId : ""
  );

  const submitDecisionMutation = useSubmitDecision(sessionId);
  const startSessionMutation = useStartSession();

  // States
  const [feedbackData, setFeedbackData] = useState<DecisionResponse | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());

  // Reset timer on node change
  useEffect(() => {
    if (session?.current_node) {
      setStartTime(Date.now());
    }
  }, [session?.current_node?.node_id]);

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="p-8 text-center space-y-4">
        <h3 className="text-lg font-bold text-red-500">Failed to load session</h3>
        <p className="text-xs text-brand-blue-light/50">
          Make sure the session ID is correct and you have permission to view it.
        </p>
        <Button onClick={() => router.push(`/${role}/practice`)} variant="secondary">
          Back to Practice Hub
        </Button>
      </div>
    );
  }

  const handleRestart = () => {
    startSessionMutation.mutate(session.scenario_key, {
      onSuccess: (data) => {
        setFeedbackData(null);
        router.replace(`/${role}/practice/${data.id}`);
      },
    });
  };

  const handleBackToHub = () => {
    router.push(`/${role}/practice`);
  };

  const handleChoiceSubmit = (choiceId: string, inputValue?: any) => {
    const timeTakenMs = Date.now() - startTime;
    submitDecisionMutation.mutate(
      {
        choiceId,
        inputValue,
        timeTakenMs,
      },
      {
        onSuccess: (data) => {
          setFeedbackData(data);
        },
      }
    );
  };

  // Render completed view (debrief)
  if (isCompleted) {
    if (debriefLoading || !debrief) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
        </div>
      );
    }
    return (
      <DebriefPanel
        debrief={debrief}
        onRestart={handleRestart}
        onBackToHub={handleBackToHub}
      />
    );
  }

  const currentNode = session.current_node;
  if (!currentNode) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between border-b border-black/5 pb-4">
        <button
          onClick={handleBackToHub}
          className="flex items-center gap-2 text-xs font-semibold text-brand-blue-light/60 hover:text-brand-blue-dark transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Practice Hub
        </button>

        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-brand-gold" />
          <span className="text-xs font-bold text-brand-blue-dark">
            Score: {session.score} pts
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="max-w-3xl mx-auto">
        <ProgressBar current={session.decisions_count} total={3} />
      </div>

      {/* Narrative Panel */}
      <div className="max-w-3xl mx-auto">
        <NarrativePanel text={currentNode.text} />
      </div>

      {/* Choices or Feedback */}
      <div className="max-w-3xl mx-auto">
        {feedbackData ? (
          <DecisionFeedback
            isCorrect={feedbackData.is_correct}
            scoreAwarded={feedbackData.score_awarded}
            feedback={feedbackData.feedback}
            citation={feedbackData.citation}
            onContinue={() => setFeedbackData(null)}
          />
        ) : currentNode.player_input ? (
          <InputNode
            inputType={currentNode.input_type}
            disabled={submitDecisionMutation.isPending}
            onSubmit={(val) => {
              // For inputs, we match the condition on the backend.
              // We pass choiceId = "" since it's evaluated on input conditions.
              handleChoiceSubmit("", val);
            }}
          />
        ) : (
          <div className="space-y-3">
            <span className="text-[9px] font-bold uppercase tracking-wider text-brand-blue-light/40 block mb-1">
              Select Your Action:
            </span>
            {currentNode.choices.map((choice, index) => (
              <ChoiceCard
                key={choice.id}
                id={choice.id}
                text={choice.text}
                index={index}
                disabled={submitDecisionMutation.isPending}
                onClick={() => handleChoiceSubmit(choice.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
