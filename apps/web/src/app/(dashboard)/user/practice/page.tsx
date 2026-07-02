"use client";

import { useFeatures } from "@/shared/hooks/useFeatures";
import { notFound } from "next/navigation";
import { PracticeHub } from "@/features/practice/components/PracticeHub";

export default function UserPracticeHubPage() {
  const { features, isLoading } = useFeatures();

  if (isLoading) {
    return <div className="p-6 text-gray-400">Loading...</div>;
  }

  if (!features.practice) {
    notFound();
  }

  return (
    <div className="animate-fade-in-up">
      <PracticeHub role="user" />
    </div>
  );
}
