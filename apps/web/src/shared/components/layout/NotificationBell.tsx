"use client";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, BellRing } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/shared/lib/supabase/client";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "@/shared/lib/api/notifications";
import { Notification } from "@/entities/types";
import { apiClient } from "@/shared/lib/api/client";

const BASE_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [shake, setShake] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [visibleCount, setVisibleCount] = useState(5);

  // Fetch unread notifications
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications", "unread"],
    queryFn: () => getNotifications("unread", 100),
    refetchInterval: false, // Disables active polling since we use SSE!
  });

  // Reset visibleCount when dropdown is closed
  useEffect(() => {
    if (!open) {
      setVisibleCount(5);
    }
  }, [open]);

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Mark single as read mutation
  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // SSE setup
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 1000;
    const maxRetryDelay = 30000;
    let active = true;

    async function connectSSE() {
      if (!active) return;
      try {
        // Fetch short-lived ticket using our unified API client
        const { ticket } = await apiClient.post<{ ticket: string }>("/notifications/ticket", {});

        if (!active) return;

        es = new EventSource(`${BASE_API_URL}/api/v1/notifications/stream?ticket=${encodeURIComponent(ticket)}`);

        es.onopen = () => {
          retryDelay = 1000; // reset delay on successful connection
        };

        es.addEventListener("notification", () => {
          // Invalidate cache to refetch
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          // Trigger shake animation
          setShake(true);
        });

        es.onerror = () => {
          if (es) {
            es.close();
            es = null;
          }
          scheduleReconnect();
        };
      } catch (err) {
        // Suppress noisy stack traces for common network failures/offline states
        const isNetworkErr = err instanceof TypeError && err.message === "Failed to fetch";
        if (isNetworkErr) {
          console.warn("Notification server is offline or unreachable. Retrying in background...");
        } else {
          console.error("SSE connection setup failed:", err);
        }
        scheduleReconnect();
      }
    }

    function scheduleReconnect() {
      if (!active) return;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(() => {
        connectSSE();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, maxRetryDelay); // exponential backoff
    }

    connectSSE();

    return () => {
      active = false;
      if (es) es.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [queryClient]);

  // Reset shake after animation ends
  useEffect(() => {
    if (!shake) return;
    const t = setTimeout(() => setShake(false), 800);
    return () => clearTimeout(t);
  }, [shake]);

  // Click outside handler to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = async (notif: Notification) => {
    setOpen(false);
    if (notif.status === "unread") {
      await markReadMutation.mutateAsync(notif.id);
    }
    if (notif.action?.url) {
      router.push(notif.action.url);
    }
  };

  const unreadCount = notifications.length;

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 transition-all duration-200 hover:bg-white/5 hover:border-white/20 text-white/70 hover:text-white ${
          shake ? "animate-bounce" : ""
        }`}
        aria-label="Notifications"
      >
        {unreadCount > 0 ? (
          <BellRing className={`h-4.5 w-4.5 text-brand-gold ${shake ? "animate-pulse" : ""}`} />
        ) : (
          <Bell className="h-4.5 w-4.5" />
        )}

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-brand-gold text-[9px] font-bold text-brand-blue-dark ring-2 ring-brand-blue-dark">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute right-0 lg:right-auto lg:left-0 mt-2.5 z-50 w-80 rounded-2xl border border-white/10 bg-brand-blue-dark/95 backdrop-blur-md p-4 text-brand-base-100 shadow-2xl animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex items-center justify-between border-b border-white/8 pb-3">
            <span className="text-sm font-semibold tracking-wide">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                className="flex items-center gap-1.5 text-[11px] font-medium text-brand-gold/75 hover:text-brand-gold transition-colors"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="mt-3 max-h-64 overflow-y-auto space-y-2.5 custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-white/40">
                <Bell className="h-7 w-7 stroke-[1.2] mb-1.5 opacity-60" />
                <span className="text-[12px]">All caught up!</span>
              </div>
            ) : (
              <>
                {notifications.slice(0, visibleCount).map((notif) => {
                  // Formatting templates locally if they are processed.
                  // title and body are resolved on backend templates.
                  const data = notif.data as Record<string, string | undefined>;
                  const title = data.matter_title ?? "Update";
                  let description = "You have a new update.";
                  if (notif.type === "matter_assigned") {
                    description = `Advocate ${data.lawyer_name} has been assigned.`;
                  } else if (notif.type === "hearing_scheduled") {
                    description = `New hearing on ${data.hearing_date}.`;
                  } else if (notif.type === "milestone_completed") {
                    description = `Milestone completed: ${data.milestone_title}.`;
                  } else if (notif.type === "comment_added") {
                    description = `New message from ${data.author_name}.`;
                  }

                  return (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className="w-full text-left flex flex-col gap-1 rounded-xl p-2.5 bg-white/3 hover:bg-white/6 transition-all border border-transparent hover:border-white/5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-bold text-brand-gold/90 truncate max-w-[200px]">{title}</span>
                        <span className="text-[9px] text-white/30">
                          {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/60 line-clamp-2 leading-relaxed">{description}</p>
                    </button>
                  );
                })}
                
                {notifications.length > visibleCount && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVisibleCount((prev) => prev + 5);
                    }}
                    className="w-full py-2 text-center text-[11px] font-semibold text-brand-gold hover:text-brand-gold-light hover:bg-white/3 rounded-xl transition-all mt-2"
                  >
                    Load More
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
