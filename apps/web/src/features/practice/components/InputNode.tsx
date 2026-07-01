import { useState } from "react";
import { Input, Button } from "@/shared/components/ui";

export function InputNode({
  inputType,
  onSubmit,
  disabled,
}: {
  inputType: string | null;
  onSubmit: (val: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;
    onSubmit(value);
  };

  const inputTypeAttr = inputType === "date" ? "date" : "text";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 p-5 rounded-xl border border-brand-gold/12 bg-base-100/50 shadow-sm animate-fade-in-up"
    >
      <Input
        id="player-input-field"
        type={inputTypeAttr}
        label={inputType === "date" ? "Select/Enter Notice Date" : "Your Answer"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required
        disabled={disabled}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={!value || disabled} variant="gold">
          {disabled ? "Evaluating..." : "Submit Answer"}
        </Button>
      </div>
    </form>
  );
}
