// 실제 FastAPI 백엔드용 fetch 래퍼 (front.md §6, backend.md).
//
// src/api/*.js 의 각 함수는 이 파일의 request()/withQuery() 를 통해 실제 백엔드
// (backend/app)를 호출한다. 백엔드는 항상 media URL을 절대경로로 내려주므로
// (backend.md §3.4) resolveMediaUrl은 그 값을 그대로 통과시킨다.

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

function withBase(url) {
  if (/^https?:\/\//.test(url)) return url;
  return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

// path에 쿼리 파라미터를 붙인다. undefined/null/빈 문자열은 생략한다.
export function withQuery(path, params) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== "") qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}

export function resolveMediaUrl(url) {
  if (!url) return url;
  if (/^https?:\/\/|^blob:/.test(url)) return url;
  return withBase(url);
}

function getAccessToken() {
  return localStorage.getItem("access_token");
}

function getRefreshToken() {
  return localStorage.getItem("refresh_token");
}

function setTokens({ access_token, refresh_token }) {
  if (access_token) localStorage.setItem("access_token", access_token);
  if (refresh_token) localStorage.setItem("refresh_token", refresh_token);
}

function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

function normalizeError(status, body) {
  if (body && typeof body.detail === "string") return { status, message: body.detail };
  if (body && Array.isArray(body.detail)) {
    return { status, message: body.detail.map((e) => e.msg).join(", ") };
  }
  return { status, message: "알 수 없는 오류가 발생했습니다." };
}

let refreshPromise = null;

async function doRefresh() {
  const refresh_token = getRefreshToken();
  if (!refresh_token) throw new Error("no refresh token");
  const res = await fetch(withBase("/api/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token }),
  });
  if (!res.ok) throw new Error("refresh failed");
  const data = await res.json();
  setTokens(data);
  return data;
}

export async function request(path, { method = "GET", body, isForm = false, auth = true, retry = true } = {}) {
  const headers = {};
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (!isForm && body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(withBase(path), {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  if (res.status === 401 && auth && retry) {
    if (!getRefreshToken()) {
      // 애초에 로그인하지 않은 상태(게스트)에서 인증이 필요한 호출을 한 것이다 — 예:
      // 게스트도 보는 홈 화면의 StoryBar가 배경에서 /stories/tray를 불러오는 경우.
      // "세션 만료"가 아니므로 리다이렉트하지 않고 401을 그대로 호출자에게 넘긴다.
      // (여기서 강제 리다이렉트하면 게스트가 보고 있던 페이지가 중간에 날아간다.)
    } else {
      try {
        if (!refreshPromise) refreshPromise = doRefresh().finally(() => (refreshPromise = null));
        await refreshPromise;
        return request(path, { method, body, isForm, auth, retry: false });
      } catch {
        clearTokens();
        window.location.href = "/login";
        throw new Error("세션이 만료되었습니다.");
      }
    }
  }

  if (res.status === 204) return null;

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const { message } = normalizeError(res.status, data);
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  return data;
}

export const tokenStore = { getAccessToken, getRefreshToken, setTokens, clearTokens };
