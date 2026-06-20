import { apiClient } from "./client";
import {
  Notification,
  NotificationPreference,
  PreferenceUpdate,
} from "@/entities/types";

export async function getNotifications(
  status?: "UNREAD" | "READ" | "DISMISSED",
  limit = 20,
  offset = 0
): Promise<Notification[]> {
  const queryParams = new URLSearchParams();
  if (status) queryParams.append("status", status);
  queryParams.append("limit", limit.toString());
  queryParams.append("offset", offset.toString());

  return apiClient.get<Notification[]>(
    `/notifications?${queryParams.toString()}`
  );
}

export async function markNotificationRead(id: string): Promise<Notification> {
  return apiClient.patch<Notification>(`/notifications/${id}/read`, {});
}

export async function markAllNotificationsRead(): Promise<Notification[]> {
  return apiClient.post<Notification[]>("/notifications/read-all", {});
}

// ── Delivery Preferences ──────────────────────────────────────────────────────

export async function getNotificationPreferences(): Promise<
  NotificationPreference[]
> {
  return apiClient.get<NotificationPreference[]>("/notifications/preferences");
}

export async function updateNotificationPreferences(
  updates: PreferenceUpdate[]
): Promise<NotificationPreference[]> {
  return apiClient.patch<NotificationPreference[]>(
    "/notifications/preferences",
    updates
  );
}
