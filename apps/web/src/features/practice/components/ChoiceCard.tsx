import { Card } from "@/shared/components/ui";

export function ChoiceCard({
  id,
  text,
  index,
  onClick,
  disabled,
}: {
  id: string;
  text: string;
  index: number;
  onClick: () => void;
  disabled: boolean;
}) {
  const letters = ["A", "B", "C", "D", "E"];
  const letter = letters[index] || String(index + 1);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left outline-none block disabled:opacity-50 disabled:cursor-not-allowed group"
    >
      <Card
        hover={!disabled}
        className={`p-4 flex items-start gap-4 transition-all duration-300 ${
          disabled
            ? "border-brand-gold/5 bg-base-100/40"
            : "border-brand-gold/12 hover:border-brand-gold bg-base-100 group-hover:shadow-md"
        }`}
      >
        {/* Letter Indicator */}
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold text-xs border transition-colors ${
            disabled
              ? "border-brand-gold/10 bg-brand-gold/5 text-brand-gold/40"
              : "border-brand-gold/20 bg-brand-gold/10 text-brand-gold group-hover:bg-brand-gold group-hover:text-brand-blue-dark group-hover:border-brand-gold"
          }`}
        >
          {letter}
        </div>

        {/* Choice Text */}
        <div className="flex-1 pt-0.5">
          <p className="text-sm font-semibold text-brand-blue-dark leading-relaxed group-hover:text-brand-blue-light transition-colors">
            {text}
          </p>
        </div>
      </Card>
    </button>
  );
}
