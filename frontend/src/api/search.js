import { request, withQuery } from "./client";

export const search = (q, type = "all") => request(withQuery("/api/search", { q, type }));

export const getHashtag = (name, cursor) =>
  request(withQuery(`/api/hashtags/${encodeURIComponent(name)}`, { cursor }));
