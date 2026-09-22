const UNITS = [
  { limit: 60, divisor: 1, unit: "초" },
  { limit: 3600, divisor: 60, unit: "분" },
  { limit: 86400, divisor: 3600, unit: "시간" },
  { limit: 604800, divisor: 86400, unit: "일" },
  { limit: 2629800, divisor: 604800, unit: "주" },
  { limit: 31557600, divisor: 2629800, unit: "개월" },
];

export function timeAgo(isoString) {
  if (!isoString) return "";
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return "";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - then) / 1000));

  if (diffSeconds < 5) return "방금";

  for (const { limit, divisor, unit } of UNITS) {
    if (diffSeconds < limit) {
      return `${Math.floor(diffSeconds / divisor)}${unit} 전`;
    }
  }
  const years = Math.floor(diffSeconds / 31557600);
  return `${years}년 전`;
}
