import { request } from "./client";

// DELETE /stories/{id} 는 백엔드에 없다(backend.md §4 검증 노트 — 삭제 UI가 없어 만들지 않았다).

export const getStoryTray = () => request("/api/stories/tray");
export const getUserStories = (username) => request(`/api/stories/user/${encodeURIComponent(username)}`);

export async function createStory(file) {
  const form = new FormData();
  form.append("file", file);
  return request("/api/stories", { method: "POST", body: form, isForm: true });
}

export const viewStory = (storyId) => request(`/api/stories/${storyId}/view`, { method: "POST" });
export const getStoryViewers = (storyId) => request(`/api/stories/${storyId}/viewers`);
