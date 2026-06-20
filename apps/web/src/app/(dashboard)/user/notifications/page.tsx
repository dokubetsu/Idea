"use client";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Mail, MessageSquare, Check, Loader2, Info } from "lucide-react";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/shared/lib/api/notifications";
import {
  NotificationPreference,
  NotificationType,
  NotificationChannel,
  PreferenceUpdate,
} from "@/entities/types";

// ── Metadata ─────────────────────────────────────────────────────────────────
const NOTIFICATION_TYPES: {
  type: NotificationType;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    type: "matter_assigned",
    label: "Advocate Assigned",
    description: "When a lawyer is assigned to your case",
    icon: "⚖",
  },
  {
    type: "hearing_scheduled",
    label: "Hearing Scheduled",
    description: "When a court date is added or changed",
    icon: "📅",
  },
  {
    type: "milestone_completed",
    label: "Milestone Reached",
    description: "When your case progresses to a new stage",
    icon: "✅",
  },
  {
    type: "comment_added",
    label: "New Message",
    description: "When your advocate posts a case update",
    icon: "💬",
  },
];

const CHANNELS: { channel: NotificationChannel; label: string; icon: React.ReactNode; alwaysOn?: boolean }[] = [
  { channel: "IN_APP", label: "In-App", icon: <Bell className="h-4 w-4" />, alwaysOn: true },
  { channel: "EMAIL", label: "Email", icon: <Mail className="h-4 w-4" /> },
  { channel: "SMS", label: "SMS", icon: <MessageSquare className="h-4 w-4" /> },
];

// ── Helper: build a key → enabled lookup from preference list ─────────────────
type PrefMap = Record<string, boolean>; // key: `${type}__${channel}`

function buildPrefMap(prefs: NotificationPreference[]): PrefMap {
  const map: PrefMap = {};
  for (const p of prefs) {
    map[`${p.type}__${p.channel}`] = p.enabled;
  }
  return map;
}

function isEnabled(map: PrefMap, type: NotificationType, channel: NotificationChannel): boolean {
  const key = `${type}__${channel}`;
  return key in map ? map[key] : true; // default opt-in
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────
function Toggle({
  enabled,
  disabled,
  onChange,
  saving,
}: {
  enabled: boolean;
  disabled?: boolean;
  onChange: () => void;
  saving?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled || saving}
      aria-pressed={enabled}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 ${
        disabled
          ? "cursor-not-allowed opacity-50 bg-brand-gold/30"
          : enabled
          ? "bg-brand-gold cursor-pointer"
          : "bg-brand-blue-light/20 cursor-pointer hover:bg-brand-blue-light/30"
      }`}
    >
      <span
        className={`inline-block h-4.5 w-4.5 transform rounded-full transition-transform duration-300 shadow-sm ${
          enabled ? "translate-x-5.5 bg-brand-blue-dark" : "translate-x-0.5 bg-white"
        }`}
      />
      {saving && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-3 w-3 animate-spin text-brand-blue-dark" />
        </span>
      )}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function NotificationSettingsPage() {
  const queryClient = useQueryClient();
  const [localMap, setLocalMap] = useState<PrefMap>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const { data: prefs, isLoading } = useQuery<NotificationPreference[]>({
    queryKey: ["notification-preferences"],
    queryFn: getNotificationPreferences,
  });

  // Sync server state into local map
  useEffect(() => {
    if (prefs) {
      setLocalMap(buildPrefMap(prefs));
    }
  }, [prefs]);

  const mutation = useMutation({
    mutationFn: (updates: PreferenceUpdate[]) =>
      updateNotificationPreferences(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });

  const handleToggle = useCallback(
    async (type: NotificationType, channel: NotificationChannel) => {
      const key = `${type}__${channel}`;
      const currentValue = isEnabled(localMap, type, channel);
      const newValue = !currentValue;

      // Optimistic update
      setLocalMap((prev) => ({ ...prev, [key]: newValue }));
      setSavingKey(key);

      try {
        await mutation.mutateAsync([{ type, channel, enabled: newValue }]);
        setSavedKey(key);
        setTimeout(() => setSavedKey(null), 1800);
      } catch {
        // Revert on error
        setLocalMap((prev) => ({ ...prev, [key]: currentValue }));
      } finally {
        setSavingKey(null);
      }
    },
    [localMap, mutation]
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-brand-blue-dark">
          Notification Settings
        </h1>
        <p className="mt-1.5 text-sm text-brand-blue-light/70">
          Choose how you want to be notified about case updates. In-app
          notifications are always on.
        </p>
      </div>

      {/* Info Banner */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-brand-gold/20 bg-brand-gold/5 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-gold/70" />
        <p className="text-[13px] text-brand-blue-dark/70 leading-relaxed">
          Email and SMS notifications require a verified email/phone on your
          profile. Configure your provider keys in Settings to enable delivery.
        </p>
      </div>

      {/* Preference Matrix Card */}
      <div className="rounded-2xl border border-brand-gold/15 bg-base-100 overflow-hidden shadow-sm">
        {/* Column Headers */}
        <div className="grid grid-cols-[1fr_repeat(3,_80px)] gap-4 border-b border-brand-gold/10 px-6 py-3 bg-brand-gold/5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-brand-blue-light/60">
            Event
          </span>
          {CHANNELS.map((ch) => (
            <div key={ch.channel} className="flex flex-col items-center gap-1">
              <span className="text-brand-blue-light/50">{ch.icon}</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-brand-blue-light/60">
                {ch.label}
              </span>
            </div>
          ))}
        </div>

        {/* Rows */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-brand-gold/50" />
          </div>
        ) : (
          NOTIFICATION_TYPES.map((notifType, idx) => (
            <div
              key={notifType.type}
              className={`grid grid-cols-[1fr_repeat(3,_80px)] items-center gap-4 px-6 py-4 transition-colors hover:bg-brand-gold/5 ${
                idx < NOTIFICATION_TYPES.length - 1
                  ? "border-b border-brand-gold/10"
                  : ""
              }`}
            >
              {/* Event info */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base">{notifType.icon}</span>
                  <span className="text-sm font-bold text-brand-blue-dark">
                    {notifType.label}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-brand-blue-light/60">
                  {notifType.description}
                </p>
              </div>

              {/* Toggles */}
              {CHANNELS.map((ch) => {
                const key = `${notifType.type}__${ch.channel}`;
                const enabled = ch.alwaysOn
                  ? true
                  : isEnabled(localMap, notifType.type, ch.channel);
                const isSaving = savingKey === key;
                const isSaved = savedKey === key;

                return (
                  <div key={ch.channel} className="flex flex-col items-center gap-1.5">
                    <Toggle
                      enabled={enabled}
                      disabled={ch.alwaysOn}
                      saving={isSaving}
                      onChange={() =>
                        !ch.alwaysOn &&
                        handleToggle(notifType.type, ch.channel)
                      }
                    />
                    {isSaved && (
                      <span className="flex items-center gap-0.5 text-[10px] text-brand-teal font-bold">
                        <Check className="h-2.5 w-2.5" /> Saved
                      </span>
                    )}
                    {ch.alwaysOn && (
                      <span className="text-[10px] text-brand-blue-light/40 font-semibold">Always on</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Footer note */}
      <p className="mt-5 text-center text-[12px] text-brand-blue-light/50 font-medium">
        Changes are saved instantly. You can update these at any time.
      </p>
    </div>
  );
}
