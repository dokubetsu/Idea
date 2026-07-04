"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, Send, MessageSquare, Check, CheckCheck } from "lucide-react";

import { useMessages, useSendMessage } from "@/features/docket/hooks/useCaseOverview";
import { Card, Button, Spinner, EmptyState, cn } from "@/shared/components/ui";
import { apiClient } from "@/shared/lib/api/client";

/* ---------- types ---------- */

interface Props {
  matterId: string;
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  message_type?: string;
  created_at: string;
  read_at?: string | null;
}

interface MeResponse {
  id: string;
  email?: string;
  role?: string;
}

/* ---------- constants ---------- */

const QUICK_REPLIES = [
  "I'll review and get back to you.",
  "Please upload the document at your earliest.",
  "Your next hearing is scheduled. I'll share details.",
  "No action needed from your side currently.",
];

/* ---------- helpers ---------- */

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/* ---------- component ---------- */

export default function CommunicationsTab({ matterId }: Props) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  /* current user */
  const { data: me } = useQuery<MeResponse>({
    queryKey: ["identity", "me"],
    queryFn: () => apiClient.get<MeResponse>("/identity/me"),
  });

  /* messages */
  const { data: messages = [], isLoading } = useMessages(matterId);
  const { mutate: send, isPending: isSending } = useSendMessage(matterId);

  /* auto-scroll on new messages */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* send handler */
  const handleSend = (text?: string) => {
    const content = (text ?? draft).trim();
    if (!content) return;
    send({ content });
    if (!text) setDraft("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  /* ---------- render ---------- */

  return (
    <Card className="flex flex-col min-h-[500px] h-full">
      {/* privilege banner */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-base-200">
        <Shield className="h-3.5 w-3.5 text-brand-blue-light/50 shrink-0" />
        <p className="text-[11px] text-brand-blue-light/50 leading-tight">
          This chat is stored for security purposes. Attorney-client privilege applies.
        </p>
      </div>

      {/* chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner />
          </div>
        ) : (messages as Message[]).length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              icon={MessageSquare}
              title="Start the conversation"
              body="Send a message to begin communicating with your client."
            />
          </div>
        ) : (
          (messages as Message[]).map((msg) => {
            const isOwn = msg.sender_id === me?.id;
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  isOwn ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[75%] px-4 py-2.5 rounded-2xl",
                    isOwn
                      ? "bg-brand-gold/10 rounded-br-md"
                      : "bg-base-200 rounded-bl-md"
                  )}
                >
                  <p className="text-sm text-brand-blue leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[10px] text-brand-blue-light/40">
                      {formatTime(msg.created_at)}
                    </span>
                    {isOwn &&
                      (msg.read_at ? (
                        <CheckCheck className="h-3 w-3 text-brand-gold" />
                      ) : (
                        <Check className="h-3 w-3 text-brand-blue-light/40" />
                      ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* quick replies */}
      <div className="px-4 pb-2 flex flex-wrap gap-1.5">
        {QUICK_REPLIES.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => handleSend(text)}
            disabled={isSending}
            className="text-[11px] px-2.5 py-1 rounded-full border border-base-200 text-brand-blue-light/70 hover:bg-base-200 transition-colors disabled:opacity-50"
          >
            {text}
          </button>
        ))}
      </div>

      {/* input area */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-4 py-3 border-t border-base-200"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          disabled={isSending}
          aria-label="Message input"
          className="flex-1 bg-base-100 border border-base-200 rounded-xl px-4 py-2.5 text-sm text-brand-blue placeholder:text-brand-blue-light/40 focus:outline-none focus:ring-1 focus:ring-brand-gold/50 disabled:opacity-50"
        />
        <Button
          type="submit"
          variant="gold"
          size="sm"
          disabled={!draft.trim() || isSending}
          className="rounded-xl"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}
