"use client";

import { useParams } from "next/navigation";
import { SessionView } from "@/features/practice/components/SessionView";

export default function UserPracticeSessionPage() {
  const { sessionId } = useParams() as { sessionId: string };

  return (
    <div className="animate-fade-in-up">
      <SessionView sessionId={sessionId} role="user" />
    </div>
  );
}
