export const USERNAME_RE = /^[a-z0-9._]{1,30}$/;

export function isValidUsername(value) {
  return USERNAME_RE.test(value || "");
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || "");
}

export function isValidPassword(value) {
  return typeof value === "string" && value.length >= 8;
}

export function isValidWebsite(value) {
  if (!value) return true;
  return /^https:\/\/.+/.test(value);
}
