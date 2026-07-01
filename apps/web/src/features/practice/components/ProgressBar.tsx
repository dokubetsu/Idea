export function ProgressBar({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-brand-blue-light/50">
        <span>Progress</span>
        <span>{Math.round(percentage)}%</span>
      </div>
      <div className="h-1.5 w-full bg-brand-blue-dark/5 rounded-full overflow-hidden border border-black/5">
        <div
          className="h-full bg-gradient-to-r from-brand-gold to-brand-gold/80 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
