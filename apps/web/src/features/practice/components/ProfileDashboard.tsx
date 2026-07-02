import { useState } from "react";
import Link from "next/link";
import { Award, BookOpen, ChevronRight, Compass, ShieldAlert, ShieldCheck } from "lucide-react";
import { usePracticeProfile, usePracticeHistory } from "../hooks/usePractice";
import { BlindSpotChart } from "./BlindSpotChart";
import { Card, Button, Badge } from "@/shared/components/ui";

export function ProfileDashboard({ role }: { role: "user" | "lawyer" }) {
  const [page, setPage] = useState(1);
  const { data: profile, isLoading: profileLoading } = usePracticeProfile();
  const { data: history = [], isLoading: historyLoading } = usePracticeHistory({
    page,
    perPage: 10,
  });

  if (profileLoading || historyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
      </div>
    );
  }

  const blindSpots = profile?.blind_spots ?? [];
  const strengths = profile?.strengths ?? [];

  // Calculate aggregates
  const allSpots = [...blindSpots, ...strengths];
  const totalAttempts = allSpots.reduce((sum, s) => sum + s.attempts, 0);
  const totalCorrect = allSpots.reduce((sum, s) => sum + s.correct, 0);
  const overallAccuracy =
    totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  const completedSessions = history.filter((h) => h.status === "completed");
  const avgScore =
    completedSessions.length > 0
      ? Math.round(
          completedSessions.reduce((sum, h) => sum + h.score, 0) /
            completedSessions.length
        )
      : 0;

  // Group domain stats
  const domainStats: Record<string, { count: number; totalScore: number; maxScore: number }> = {};
  completedSessions.forEach((sess) => {
    if (!domainStats[sess.domain]) {
      domainStats[sess.domain] = { count: 0, totalScore: 0, maxScore: 0 };
    }
    domainStats[sess.domain].count += 1;
    domainStats[sess.domain].totalScore += sess.score;
    domainStats[sess.domain].maxScore += sess.max_score;
  });

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Page Header */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
          Practice Metrics & Analytics
        </p>
        <h1 className="mt-1 font-serif text-4xl font-bold">Your Litigation Profile.</h1>
        <p className="mt-1.5 text-sm text-brand-blue-light/55">
          Review your skill accuracy, identify conceptual blind spots, and track your history.
        </p>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-5 flex flex-col justify-between">
          <span className="text-[9px] font-bold uppercase tracking-wider text-brand-blue-light/40">
            Sessions Completed
          </span>
          <span className="text-3xl font-serif font-bold text-brand-blue-dark mt-2">
            {completedSessions.length}
          </span>
        </Card>

        <Card className="p-5 flex flex-col justify-between">
          <span className="text-[9px] font-bold uppercase tracking-wider text-brand-blue-light/40">
            Overall Accuracy
          </span>
          <span className="text-3xl font-serif font-bold text-brand-teal mt-2">
            {overallAccuracy}%
          </span>
        </Card>

        <Card className="p-5 flex flex-col justify-between">
          <span className="text-[9px] font-bold uppercase tracking-wider text-brand-blue-light/40">
            Average Score
          </span>
          <span className="text-3xl font-serif font-bold text-brand-gold mt-2">
            {avgScore} pts
          </span>
        </Card>

        <Card className="p-5 flex flex-col justify-between">
          <span className="text-[9px] font-bold uppercase tracking-wider text-brand-blue-light/40">
            Strongest Area
          </span>
          <span className="text-sm font-bold text-brand-blue-dark truncate mt-2">
            {strengths[0]
              ? strengths[0].issue_tag.replace(/_/g, " ").toUpperCase()
              : "N/A"}
          </span>
        </Card>
      </div>

      {/* Main Grid: Blind spots vs Strengths */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Blind spots */}
        <Card className="p-6 space-y-4">
          <h3 className="font-serif text-xl font-bold flex items-center gap-2 text-red-600">
            <ShieldAlert className="w-5 h-5" />
            Conceptual Blind Spots
          </h3>
          <div className="h-px bg-brand-gold/12" />
          <BlindSpotChart spots={blindSpots.filter((s) => s.accuracy <= 0.75)} />
        </Card>

        {/* Strengths */}
        <Card className="p-6 space-y-4">
          <h3 className="font-serif text-xl font-bold flex items-center gap-2 text-brand-teal">
            <ShieldCheck className="w-5 h-5" />
            Core Legal Strengths
          </h3>
          <div className="h-px bg-brand-gold/12" />
          <BlindSpotChart spots={strengths.filter((s) => s.accuracy > 0.75)} />
        </Card>
      </div>

      {/* Domain Coverage Grid */}
      <div className="space-y-4">
        <h3 className="font-serif text-xl font-bold text-brand-blue-dark">
          Domain Coverage
        </h3>
        {Object.keys(domainStats).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(domainStats).map(([dom, stats]) => {
              const domainAvg = stats.maxScore > 0 ? Math.round(
                (stats.totalScore / stats.maxScore) * 100
              ) : 0;
              return (
                <Card key={dom} className="p-5 space-y-3">
                  <Badge tone="teal" className="text-[9px] font-semibold">
                    {dom}
                  </Badge>
                  <div className="flex justify-between items-end pt-1">
                    <div>
                      <span className="text-[10px] block text-brand-blue-light/40 uppercase tracking-wider">
                        Sessions
                      </span>
                      <span className="text-xl font-bold text-brand-blue-dark">
                        {stats.count} completed
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] block text-brand-blue-light/40 uppercase tracking-wider">
                        Avg Score
                      </span>
                      <span className="text-xl font-bold text-brand-gold">
                        {domainAvg}%
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-brand-blue-light/40">
            Complete scenario sessions to compile domain coverage insights.
          </p>
        )}
      </div>

      {/* Practice History Table */}
      <div className="space-y-4">
        <h3 className="font-serif text-xl font-bold text-brand-blue-dark">
          Practice Session History
        </h3>
        <Card className="overflow-hidden border-brand-gold/12">
          {history.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-blue-dark/5 border-b border-black/5 text-[10px] uppercase font-bold tracking-wider text-brand-blue-light/50">
                    <th className="p-4">Scenario Title</th>
                    <th className="p-4">Domain</th>
                    <th className="p-4">Difficulty</th>
                    <th className="p-4">Score Achieved</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {history.map((item) => {
                    const diffTone = {
                      beginner: "teal" as const,
                      intermediate: "gold" as const,
                      advanced: "red" as const,
                    }[item.difficulty] || ("gold" as const);

                    return (
                      <tr
                        key={item.id}
                        className="text-xs text-brand-blue-light/80 hover:bg-black/[0.01] transition-colors"
                      >
                        <td className="p-4 font-bold text-brand-blue-dark">
                          {item.scenario_title}
                        </td>
                        <td className="p-4">{item.domain}</td>
                        <td className="p-4">
                          <Badge tone={diffTone} className="text-[9px]">
                            {item.difficulty}
                          </Badge>
                        </td>
                        <td className="p-4 font-semibold text-brand-gold">
                          {item.score} / {item.max_score}
                        </td>
                        <td className="p-4 capitalize">
                          <span
                            className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                              item.status === "completed"
                                ? "bg-green-500"
                                : item.status === "active"
                                ? "bg-yellow-500"
                                : "bg-gray-400"
                            }`}
                          />
                          {item.status}
                        </td>
                        <td className="p-4 text-right">
                          {item.status === "completed" ? (
                            <Link href={`/${role}/practice/${item.id}`}>
                              <button className="text-brand-gold hover:text-brand-gold-light font-bold text-xs flex items-center gap-1 ml-auto">
                                Review Debrief <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </Link>
                          ) : (
                            <Link href={`/${role}/practice/${item.id}`}>
                              <button className="text-brand-teal hover:text-brand-teal/80 font-bold text-xs flex items-center gap-1 ml-auto">
                                Resume <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Pagination controls */}
              <div className="flex items-center justify-between p-4 border-t border-black/5 bg-brand-blue-dark/[0.02]">
                <Button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page === 1}
                  variant="outline"
                  className="text-xs py-1.5 px-3"
                >
                  Previous
                </Button>
                <span className="text-xs text-brand-blue-light/60 font-semibold">
                  Page {page}
                </span>
                <Button
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={history.length < 10}
                  variant="outline"
                  className="text-xs py-1.5 px-3"
                >
                  Next
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Compass className="w-12 h-12 text-brand-gold/40 mb-3" />
              <p className="text-sm font-semibold text-brand-blue-dark">
                No past sessions recorded
              </p>
              <p className="text-xs text-brand-blue-light/50 mt-1 max-w-sm">
                Start your first legal practice scenario from the hub to see your history logged here.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
