import { request, withQuery } from "./client";

export const getComments = (postId, cursor) => request(withQuery(`/api/posts/${postId}/comments`, { cursor }));
export const getReplies = (commentId) => request(`/api/comments/${commentId}/replies`);

export const addComment = (postId, { text, parent_id }) =>
  request(`/api/posts/${postId}/comments`, { method: "POST", body: { text, parent_id } });

export const deleteComment = (commentId) => request(`/api/comments/${commentId}`, { method: "DELETE" });
export const likeComment = (commentId) => request(`/api/comments/${commentId}/like`, { method: "POST" });
export const unlikeComment = (commentId) => request(`/api/comments/${commentId}/like`, { method: "DELETE" });
