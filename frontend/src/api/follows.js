import { request } from "./client";

// GET /follow-requests, DELETE /users/{username}/block, GET /blocks 는 백엔드에 없다
// (backend.md §4 검증 노트 — 프론트에 이 기능을 쓰는 화면이 없어 만들지 않았다).

export const follow = (username) => request(`/api/users/${encodeURIComponent(username)}/follow`, { method: "POST" });
export const unfollow = (username) =>
  request(`/api/users/${encodeURIComponent(username)}/follow`, { method: "DELETE" });
export const acceptFollowRequest = (userId) => request(`/api/follow-requests/${userId}/accept`, { method: "POST" });
export const rejectFollowRequest = (userId) => request(`/api/follow-requests/${userId}/reject`, { method: "POST" });
export const block = (username) => request(`/api/users/${encodeURIComponent(username)}/block`, { method: "POST" });
