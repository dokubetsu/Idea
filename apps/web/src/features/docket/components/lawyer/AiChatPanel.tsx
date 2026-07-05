"use client";

import { useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { Card, Button, Input, Spinner } from "@/shared/components/ui";
import { useAskCaseAi } from "@/features/docket/hooks/useCaseOverview";

interface AiChatPanelProps {
  matterId: string;
}

const SUGGESTIONS = [
  "Summarize defendant's WS",
  "Find precedents",
  "Draft a reply paragraph",
] as const;

export default function AiChatPanel({ matterId }: AiChatPanelProps) {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<string | null>(null);

  const askAi = useAskCaseAi(matterId);

  const handleSend = async (prompt: string) => {
    if (!prompt.trim()) return;
    setResponse(null);
    const result = await askAi.mutateAsync(prompt.trim());
    setResponse(result.response);
    setQuery("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(query);
  };

  const handleSuggestion = (suggestion: string) => {
    setQuery(suggestion);
    handleSend(suggestion);
  };

  return (
    <Card className="rounded-xl border border-brand-gold/12 bg-base-100 shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-brand-accent" />
        <h3 className="text-sm font-serif font-semibold text-foreground">
          Ask about this case
        </h3>
      </div>

      {/* Suggested prompts */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => handleSuggestion(suggestion)}
            disabled={askAi.isPending}
            className="rounded-full border border-brand-gold/12 bg-brand-blue-light/5 px-3 py-1 text-[10px] font-sans text-brand-blue-dark hover:bg-brand-blue-light/10 transition-colors disabled:opacity-50"
            aria-label={`Ask: ${suggestion}`}
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 mb-3">
        <Input
          type="text"
          placeholder="Ask a question about this case..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 text-[11px]"
          disabled={askAi.isPending}
          aria-label="Case question input"
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={askAi.isPending || !query.trim()}
          className="gap-1.5"
          aria-label="Send question"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>

      {/* Response area */}
      {askAi.isPending && (
        <div className="flex items-center justify-center py-6">
          <Spinner className="h-5 w-5 text-brand-accent" />
        </div>
      )}

      {response && !askAi.isPending && (
        <div className="rounded-lg bg-brand-blue-light/5 border border-brand-blue-light/10 p-3">
          <p className="text-[11px] font-sans text-foreground leading-relaxed whitespace-pre-wrap">
            {response}
          </p>
        </div>
      )}
    </Card>
  );
}
