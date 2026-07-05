"use client";

import { useRef, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, Send, MessageSquare, Check, CheckCheck } from "lucide-react";
import { Card, Spinner, EmptyState, cn } from "@/shared/components/ui";
import { apiClient } from "@/shared/lib/api/client";
import { useMessages, useSendMessage } from "@/features/docket/hooks/useCaseOverview";

interface Props {
  matterId: string;
}

const SUGGESTED_QUESTIONS = [
  "When is my next hearing?",
  "What documents do I need?",
  "What's happening with my case?",
  "How much do I owe?",
];

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ClientMessagesTab({ matterId }: Props) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: me } = useQuery({
    queryKey: ["identity", "me"],
    queryFn: () => apiClient.get<{ id: string }>("/identity/me"),
  });

  const { data: messages = [], isLoading } = useMessages(matterId);
  const sendMessage = useSendMessage(matterId);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage.mutate({ content: trimmed, message_type: "text" });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    sendMessage.mutate({ content: question, message_type: "text" });
  };

  const myId = (me as { id: string } | undefined)?.id;

  // Determine if a message is from the current user
  const isOwnMessage = (msg: { sender_id: string }) => msg.sender_id === myId;

  // Check if a message is the first from the lawyer in a consecutive group
  const isFirstLawyerInGroup = (index: number) => {
    const msg = messages[index];
    if (isOwnMessage(msg)) return false;
    if (index === 0) return true;
    return isOwnMessage(messages[index - 1]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Security banner */}
      <Card className="px-4 py-3">
        <div className="flex items-start gap-3">
          <Shield className="h-4 w-4 mt-0.5 text-brand-teal shrink-0" />
          <div>
            <p className="text-xs text-brand-blue-light/60">
              Your conversations with your lawyer are private and legally protected.
              Chat history is stored securely.
            </p>
          </div>
        </div>
      </Card>

      {/* Response time info */}
      <p className="text-[11px] text-brand-blue-light/40 px-1">
        Your lawyer typically responds within 24 hours
      </p>

      {/* Chat area */}
      <Card className="flex flex-col overflow-hidden">
        <div
          ref={scrollRef}
          className="min-h-[400px] max-h-[500px] overflow-y-auto px-4 py-4 space-y-3"
        >
          {messages.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No messages yet"
              body="Send your first message to your lawyer."
            />
          ) : (
            messages.map((msg: { id: string; sender_id: string; content: string; read_at: string | null; created_at: string }, index: number) => {
              const own = isOwnMessage(msg);
              const showLawyerLabel = isFirstLawyerInGroup(index);

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col",
                    own ? "items-end" : "items-start"
                  )}
                >
                  {/* Lawyer label */}
                  {showLawyerLabel && (
                    <span className="text-[10px] font-medium text-brand-blue-light/50 mb-1 px-2">
                      Your Lawyer
                    </span>
                  )}

                  {/* Message bubble */}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-2.5",
                      own
                        ? "bg-brand-gold/10"
                        : "bg-base-200"
                    )}
                  >
                    <p className="text-sm text-brand-blue-dark whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  </div>

                  {/* Timestamp and read indicator */}
                  <div className="flex items-center gap-1 mt-0.5 px-2">
                    <span className="text-[10px] text-brand-blue-light/40">
                      {formatTime(msg.created_at)}
                    </span>
                    {own && (
                      msg.read_at ? (
                        <CheckCheck className="h-3 w-3 text-brand-teal" />
                      ) : (
                        <Check className="h-3 w-3 text-brand-blue-light/40" />
                      )
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Suggested questions - shown when no messages */}
        {messages.length === 0 && (
          <div className="px-4 pb-3 flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleSuggestedQuestion(q)}
                aria-label={`Send suggested question: ${q}`}
                className="rounded-full border border-brand-gold/20 bg-brand-gold/5 px-3 py-1.5 text-xs text-brand-blue-dark hover:bg-brand-gold/10 hover:border-brand-gold/30 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-brand-gold/12 px-4 py-3 flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            aria-label="Message input"
            className="flex-1 rounded-full border border-brand-gold/15 bg-base-100 px-4 py-2.5 text-sm text-brand-blue-dark outline-none placeholder:text-brand-blue-light/30 focus:border-brand-gold focus:bg-white transition-colors"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            aria-label="Send message"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gold text-white transition-all hover:bg-brand-gold-light active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendMessage.isPending ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </Card>
    </div>
  );
}
