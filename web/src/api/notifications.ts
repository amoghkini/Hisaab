import { request } from "@/api/client";

const NOTIFICATIONS = "/api/v1/notifications";

export interface Notification {
  id: number;
  kind: "payslip_draft";
  title: string;
  /** The page that deals with it. */
  link: string;
  read: boolean;
  created_at: string;
}

export interface NotificationList {
  /** The latest 50, newest first. */
  items: Notification[];
  unread_count: number;
}

export function fetchNotifications(): Promise<NotificationList> {
  return request(NOTIFICATIONS);
}

export function readNotification(id: number): Promise<void> {
  return request(`${NOTIFICATIONS}/${id}/read`, { method: "POST" });
}

export function readAllNotifications(): Promise<void> {
  return request(`${NOTIFICATIONS}/read`, { method: "POST" });
}
