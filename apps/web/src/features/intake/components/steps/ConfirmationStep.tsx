"use client";

import { ArrowLeft, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface ConfirmationStepProps {
  step: "confirm" | "done";
  onCommit: () => void;
  onBack: () => void;
  onClose: () => void;
  isPending: boolean;
  error: any;
  matterId: string | null;
}

function Loader() {
  return <span className="h-4 w-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />;
}

export function ConfirmationStep({
  step,
  onCommit,
  onBack,
  onClose,
  isPending,
  error,
  matterId,
}: ConfirmationStepProps) {
  const router = useRouter();

  if (step === "confirm") {
    return (
      <div className="space-y-5 p-6">
        <p className="text-sm text-brand-blue-light/65">
          Your case file will be created with all the details you've entered and the AI assessment.
          A lawyer will be matched to your case shortly.
        </p>
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            Something went wrong — please try again.
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-brand-gold/15 px-4 py-2.5 text-sm font-medium text-brand-blue-light/60 hover:bg-base-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            type="button"
            onClick={onCommit}
            disabled={isPending}
            className="shimmer-btn flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-blue-dark px-5 py-2.5 text-sm font-semibold text-brand-gold transition-all hover:bg-brand-blue-light disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader /> Creating…
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" /> Confirm and create case
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 py-16 text-center px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-teal/10 border border-brand-teal/25">
        <CheckCircle className="h-8 w-8 text-brand-teal" />
      </div>
      <div>
        <h3 className="font-serif text-2xl font-bold">Your case is created</h3>
        <p className="mt-2 text-sm text-brand-blue-light/55">
          Your details and assessment are saved. We'll find the right lawyer for you shortly.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-brand-gold/20 px-4 py-2 text-sm font-medium text-brand-blue-light/60 hover:bg-base-200 transition-colors"
        >
          Close
        </button>
        {matterId && (
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push(`/user/matters/${matterId}`);
            }}
            className="shimmer-btn rounded-xl bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-blue-dark hover:bg-brand-gold-light transition-all"
          >
            View my case
          </button>
        )}
      </div>
    </div>
  );
}
