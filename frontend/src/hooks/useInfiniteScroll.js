import { useEffect, useRef } from "react";

// sentinel 요소가 뷰포트에 들어오면 onIntersect 를 호출한다.
export function useInfiniteScroll({ onIntersect, enabled = true, rootMargin = "300px" }) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const node = sentinelRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onIntersect();
      },
      { rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [onIntersect, enabled, rootMargin]);

  return sentinelRef;
}
