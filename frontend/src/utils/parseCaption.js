const TOKEN_RE = /([#@])([\p{L}\p{N}_.]{1,50})/gu;

// 캡션 텍스트를 { type: "text" | "hashtag" | "mention", value }[] 로 변환한다.
export function parseCaption(text) {
  if (!text) return [];
  const parts = [];
  let lastIndex = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const [full, symbol, value] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, index) });
    }
    parts.push({ type: symbol === "#" ? "hashtag" : "mention", value });
    lastIndex = index + full.length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }
  return parts;
}

export function extractHashtags(text) {
  if (!text) return [];
  const tags = new Set();
  for (const match of text.matchAll(TOKEN_RE)) {
    if (match[1] === "#") tags.add(match[2].toLowerCase());
  }
  return [...tags];
}

export function extractMentions(text) {
  if (!text) return [];
  const mentions = new Set();
  for (const match of text.matchAll(TOKEN_RE)) {
    if (match[1] === "@") mentions.add(match[2].toLowerCase());
  }
  return [...mentions];
}
