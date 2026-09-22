import { request, withQuery } from "./client";

export const getConversations = () => request("/api/conversations");

export const getUnreadConversationCount = () => request("/api/conversations/unread-count");

export const createConversation = (userId) =>
  request("/api/conversations", { method: "POST", body: { user_id: userId } });

export const getMessages = (conversationId, afterId) =>
  request(withQuery(`/api/conversations/${conversationId}/messages`, { after_id: afterId }));

export async function sendMessage(conversationId, { text, kind = "text", file, story_id }) {
  if (kind === "image" && file) {
    const form = new FormData();
    form.append("kind", "image");
    form.append("file", file);
    return request(`/api/conversations/${conversationId}/messages`, { method: "POST", body: form, isForm: true });
  }
  return request(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    body: { text, kind, story_id },
  });
}

// 읽음 처리 후 사이드바 배지가 바로 갱신되도록 AppShell에 알린다.
export const DM_UNREAD_EVENT = "dm-unread-changed";

export const markConversationRead = (conversationId) =>
  request(`/api/conversations/${conversationId}/read`, { method: "POST" }).then((res) => {
    window.dispatchEvent(new Event(DM_UNREAD_EVENT));
    return res;
  });
