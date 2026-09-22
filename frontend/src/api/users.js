import { request, withQuery } from "./client";

export const REMOVE_AVATAR = "__REMOVE_AVATAR__";

export const getMe = () => request("/api/users/me");

export async function updateMe(patch, avatarFile) {
  const form = new FormData();
  for (const key of ["full_name", "username", "bio", "website"]) {
    if (patch[key] !== undefined) form.append(key, patch[key]);
  }
  if (patch.is_private !== undefined) form.append("is_private", String(patch.is_private));

  if (avatarFile === REMOVE_AVATAR) {
    form.append("remove_avatar", "true");
  } else if (avatarFile) {
    form.append("avatar", avatarFile);
  }

  return request("/api/users/me", { method: "PATCH", body: form, isForm: true });
}

export const getSuggested = () => request("/api/users/suggested");

export const getUserByUsername = (username) => request(`/api/users/${encodeURIComponent(username)}`);

export const getUserPosts = (username, cursor) =>
  request(withQuery(`/api/users/${encodeURIComponent(username)}/posts`, { cursor }));

export const getUserTagged = (username, cursor) =>
  request(withQuery(`/api/users/${encodeURIComponent(username)}/tagged`, { cursor }));

export const getMySaved = (cursor) => request(withQuery("/api/users/me/saved", { cursor }));

export const getFollowers = (username, cursor) =>
  request(withQuery(`/api/users/${encodeURIComponent(username)}/followers`, { cursor }));

export const getFollowing = (username, cursor) =>
  request(withQuery(`/api/users/${encodeURIComponent(username)}/following`, { cursor }));
