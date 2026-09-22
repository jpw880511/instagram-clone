import { request, withQuery } from "./client";

export const getNotifications = (cursor) => request(withQuery("/api/notifications", { cursor }));

export const markNotificationsRead = (ids) =>
  request("/api/notifications/read", { method: "POST", body: ids ? { ids } : {} });

export const getUnreadCount = () => request("/api/notifications/unread-count");
