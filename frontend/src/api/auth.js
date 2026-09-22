import { request, tokenStore } from "./client";

export async function register(payload) {
  const data = await request("/api/auth/register", { method: "POST", body: payload, auth: false, retry: false });
  tokenStore.setTokens(data);
  return data;
}

export async function login(payload) {
  const data = await request("/api/auth/login", { method: "POST", body: payload, auth: false, retry: false });
  tokenStore.setTokens(data);
  return data;
}

export async function refresh() {
  const refresh_token = tokenStore.getRefreshToken();
  const data = await request("/api/auth/refresh", {
    method: "POST",
    body: { refresh_token },
    auth: false,
    retry: false,
  });
  tokenStore.setTokens(data);
  return data;
}

export async function logout() {
  const refresh_token = tokenStore.getRefreshToken();
  try {
    if (refresh_token) {
      await request("/api/auth/logout", { method: "POST", body: { refresh_token }, auth: false, retry: false });
    }
  } finally {
    tokenStore.clearTokens();
  }
}

export async function getMe() {
  return request("/api/users/me");
}
