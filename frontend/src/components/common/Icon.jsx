// 외부 아이콘 CDN 의존 없이 인라인 SVG로 최소 아이콘 세트를 제공한다 (front.md §4.2).
const PATHS = {
  home: (
    <path d="M9 21V13.5a1 1 0 011-1h4a1 1 0 011 1V21M4.5 10.5L12 3l7.5 7.5M5 9.5V19a1 1 0 001 1h12a1 1 0 001-1V9.5" />
  ),
  search: <path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-2 6-6 2 2-6 6-2z" />
    </>
  ),
  reels: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M8 4l3 4M13 4l3 4M3 12h18" />
    </>
  ),
  send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />,
  heart: <path d="M12 21s-7.5-4.6-10-9.3C.5 8 2 4 6 4c2.2 0 3.9 1.4 6 4 2.1-2.6 3.8-4 6-4 4 0 5.5 4 4 7.7-2.5 4.7-10 9.3-10 9.3z" />,
  heartFilled: (
    <path
      d="M12 21s-7.5-4.6-10-9.3C.5 8 2 4 6 4c2.2 0 3.9 1.4 6 4 2.1-2.6 3.8-4 6-4 4 0 5.5 4 4 7.7-2.5 4.7-10 9.3-10 9.3z"
      fill="currentColor"
    />
  ),
  comment: <path d="M21 11.5a8.5 8.5 0 01-8.5 8.5 8.4 8.4 0 01-3.9-.94L3 21l1.94-5.6A8.4 8.4 0 013 12.5 8.5 8.5 0 0111.5 4a8.5 8.5 0 019.5 7.5z" />,
  bookmark: <path d="M6 4h12a1 1 0 011 1v15l-7-4-7 4V5a1 1 0 011-1z" />,
  bookmarkFilled: <path d="M6 4h12a1 1 0 011 1v15l-7-4-7 4V5a1 1 0 011-1z" fill="currentColor" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  close: <path d="M18 6L6 18M6 6l12 12" />,
  chevronLeft: <path d="M15 18l-6-6 6-6" />,
  chevronRight: <path d="M9 18l6-6-6-6" />,
  plus: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  plusSquare: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="6" height="6" />
      <rect x="15" y="3" width="6" height="6" />
      <rect x="3" y="15" width="6" height="6" />
      <rect x="15" y="15" width="6" height="6" />
    </>
  ),
  tag: <path d="M20.6 12.6L12 21.2 2.8 12 3 3l9-.2 8.6 9.8zM7 7h.01" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </>
  ),
  play: <path d="M6 4l14 8-14 8V4z" fill="currentColor" stroke="none" />,
  mute: <path d="M11 5L6 9H3v6h3l5 4V5zM16 8l4 8m0-8l-4 8" />,
  unmute: <path d="M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 010 7" />,
  logout: <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />,
  camera: (
    <>
      <path d="M4 8h3l2-2h6l2 2h3v11H4z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M21 15l-5-5L5 21" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  check: <path d="M20 6L9 17l-5-5" />,
  chat: <path d="M21 11.5a8.5 8.5 0 01-8.5 8.5 8.4 8.4 0 01-3.9-.94L3 21l1.94-5.6A8.4 8.4 0 013 12.5 8.5 8.5 0 0111.5 4a8.5 8.5 0 019.5 7.5z" />,
  bell: <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9zM9.5 21a2.5 2.5 0 005 0" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0116 0" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6" />
    </>
  ),
  save: (
    <>
      <path d="M5 3h11l4 4v13a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <path d="M8 3v5h7V3M8 21v-7h8v7" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.09A1.7 1.7 0 008 19.4a1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.55-1H3a2 2 0 110-4h.09A1.7 1.7 0 004.6 8a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 008 3.6a1.7 1.7 0 001-1.55V2a2 2 0 114 0v.09a1.7 1.7 0 001 1.55 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06A1.7 1.7 0 0019.4 8c.14.36.2.75.2 1.15V9a2 2 0 010 4h-.09a1.7 1.7 0 00-1.51 1z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" />,
};

export function Icon({ name, size = 24, filled = false, className, ...rest }) {
  const key = filled && PATHS[`${name}Filled`] ? `${name}Filled` : name;
  const content = PATHS[key];
  if (!content) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {content}
    </svg>
  );
}
