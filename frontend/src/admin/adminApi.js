// 관리자 전용 API 클라이언트. 일반 유저 인증(src/api/client.js)과는 완전히 분리된
// 토큰(admin_access_token)을 쓴다 — 관리자는 users 테이블에 없는 별도 자격증명이라
// 서로 섞이면 안 된다. refresh 개념이 없으므로 401이면 그냥 로그인 화면으로 보낸다.

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const TOKEN_KEY = "admin_access_token";

export function getAdminToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setAdminToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body } = {}) {
  const headers = {};
  const token = getAdminToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json().catch(() => null) : null;

  if (res.status === 401) {
    clearAdminToken();
  }

  if (!res.ok) {
    const message = typeof data?.detail === "string" ? data.detail : "요청을 처리할 수 없습니다.";
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  return data;
}

export async function adminLogin(username, password) {
  const data = await request("/api/admin/login", { method: "POST", body: { username, password } });
  setAdminToken(data.access_token);
  return data;
}

export function adminLogout() {
  clearAdminToken();
}

export const getStats = () => request("/api/admin/stats");

export const getUsers = ({ q, sort, order, limit, offset } = {}) => {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (sort) params.set("sort", sort);
  if (order) params.set("order", order);
  if (limit) params.set("limit", limit);
  if (offset) params.set("offset", offset);
  return request(`/api/admin/users?${params.toString()}`);
};

export const deleteUser = (userId) => request(`/api/admin/users/${userId}`, { method: "DELETE" });

export const getPosts = ({ q, author, postType, sort, order, limit, offset } = {}) => {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (author) params.set("author", author);
  if (postType) params.set("post_type", postType);
  if (sort) params.set("sort", sort);
  if (order) params.set("order", order);
  if (limit) params.set("limit", limit);
  if (offset) params.set("offset", offset);
  return request(`/api/admin/posts?${params.toString()}`);
};

export const deletePost = (postId) => request(`/api/admin/posts/${postId}`, { method: "DELETE" });
