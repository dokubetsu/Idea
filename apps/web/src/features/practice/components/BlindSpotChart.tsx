import { BlindSpotDetail } from "../types";

export function BlindSpotChart({ spots }: { spots: BlindSpotDetail[] }) {
  if (spots.length === 0) {
    return (
      <p className="text-xs text-brand-blue-light/40 text-center py-4">
        No practice data logged for these categories yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {spots.map((spot) => {
        const accuracyPct = Math.round(spot.accuracy * 100);
        const colorClass =
          accuracyPct < 50
            ? "bg-red-500"
            : accuracyPct <= 75
            ? "bg-brand-gold"
            : "bg-brand-teal";

        return (
          <div key={spot.issue_tag} className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="font-semibold text-brand-blue-dark">
                {spot.issue_tag.replace(/_/g, " ").toUpperCase()}
              </span>
              <span className="font-bold text-brand-blue-light/70">
                {accuracyPct}%
              </span>
            </div>
            <div className="h-2.5 w-full bg-brand-blue-dark/5 rounded-full overflow-hidden border border-black/5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
                style={{ width: `${accuracyPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-brand-blue-light/40">
              <span>{spot.attempts} attempts</span>
              <span>Streak: {spot.streak} 🔥</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
