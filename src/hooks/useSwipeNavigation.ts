import { useEffect, useRef } from 'react';

interface Options {
  onSwipeLeft?: () => void;   // right→left finger
  onSwipeRight?: () => void;  // left→right finger
  threshold?: number;          // min px
  edgeIgnore?: number;         // ignore touches starting within Npx of edge
  enabled?: boolean;
}

/**
 * Lightweight horizontal swipe detector. Attach the returned ref to the
 * scrollable content container. Vertical swipes are ignored.
 */
export function useSwipeNavigation<T extends HTMLElement = HTMLDivElement>(opts: Options) {
  const { onSwipeLeft, onSwipeRight, threshold = 60, edgeIgnore = 16, enabled = true } = opts;
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let startX = 0, startY = 0, active = false;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (t.clientX < edgeIgnore || t.clientX > window.innerWidth - edgeIgnore) {
        active = false; return;
      }
      startX = t.clientX; startY = t.clientY; active = true;
    };
    const onEnd = (e: TouchEvent) => {
      if (!active) return;
      active = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) < threshold) return;
      if (Math.abs(dy) > Math.abs(dx) * 0.7) return; // mostly vertical
      if (dx < 0) onSwipeLeft?.(); else onSwipeRight?.();
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
    };
  }, [onSwipeLeft, onSwipeRight, threshold, edgeIgnore, enabled]);

  return ref;
}
