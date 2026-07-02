"use client";

import { useParams, notFound } from "next/navigation";
import { useFeatures } from "@/shared/hooks/useFeatures";
import { SessionView } from "@/features/practice/components/SessionView";

export default function LawyerPracticeSessionPage() {
  const { sessionId } = useParams() as { sessionId: string };
  const { features, isLoading } = useFeatures();

  if (isLoading) {
    return <div className="p-6 text-gray-400">Loading...</div>;
  }

  if (!features.practice) {
    notFound();
  }

  return (
    <div className="animate-fade-in-up">
      <SessionView sessionId={sessionId} role="lawyer" />
    </div>
  );
}
