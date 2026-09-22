import { request, withQuery } from "./client";

export async function createPost({ caption, location, post_type, files, tagged_usernames }) {
  const form = new FormData();
  if (caption) form.append("caption", caption);
  if (location) form.append("location", location);
  form.append("post_type", post_type || "post");
  if (tagged_usernames?.length) form.append("tagged_usernames", JSON.stringify(tagged_usernames));
  for (const file of files || []) form.append("files", file);
  return request("/api/posts", { method: "POST", body: form, isForm: true });
}

export const getPost = (postId) => request(`/api/posts/${postId}`);
export const deletePost = (postId) => request(`/api/posts/${postId}`, { method: "DELETE" });
export const likePost = (postId) => request(`/api/posts/${postId}/like`, { method: "POST" });
export const unlikePost = (postId) => request(`/api/posts/${postId}/like`, { method: "DELETE" });
export const savePost = (postId) => request(`/api/posts/${postId}/save`, { method: "POST" });
export const unsavePost = (postId) => request(`/api/posts/${postId}/save`, { method: "DELETE" });
export const getLikers = (postId) => request(`/api/posts/${postId}/likers`);

export const getFeed = (cursor) => request(withQuery("/api/feed", { cursor }));
export const getPublicFeed = (cursor) => request(withQuery("/api/feed/public", { cursor }));
export const getExplore = (cursor) => request(withQuery("/api/explore", { cursor }));
export const getReels = (cursor) => request(withQuery("/api/reels", { cursor }));
