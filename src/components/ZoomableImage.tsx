import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';

interface Props {
  src: string;
  alt?: string;
  className?: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;

/**
 * Image viewer with native pinch-to-zoom (touch), wheel/ctrl-wheel zoom (desktop),
 * double-tap/double-click to toggle, and drag-to-pan when zoomed in.
 */
const ZoomableImage: React.FC<Props> = ({ src, alt, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  // Refs for gesture state (so handlers don't re-bind constantly)
  const stateRef = useRef({ scale: 1, tx: 0, ty: 0 });
  useEffect(() => { stateRef.current = { scale, tx, ty }; }, [scale, tx, ty]);

  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; scale: number; cx: number; cy: number; tx: number; ty: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTap = useRef<number>(0);

  const clampTranslate = useCallback((nx: number, ny: number, s: number) => {
    const el = containerRef.current;
    if (!el) return { x: nx, y: ny };
    const { width, height } = el.getBoundingClientRect();
    const maxX = (width * (s - 1)) / 2;
    const maxY = (height * (s - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, nx)),
      y: Math.max(-maxY, Math.min(maxY, ny)),
    };
  }, []);

  const reset = useCallback(() => { setScale(1); setTx(0); setTy(0); }, []);

  const zoomAt = useCallback((nextScale: number, originX: number, originY: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = originX - rect.left - rect.width / 2;
    const cy = originY - rect.top - rect.height / 2;
    const { scale: s, tx: x, ty: y } = stateRef.current;
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
    const ratio = clamped / s;
    const newTx = x - (cx - x) * (ratio - 1);
    const newTy = y - (cy - y) * (ratio - 1);
    const c = clampTranslate(newTx, newTy, clamped);
    setScale(clamped);
    setTx(c.x);
    setTy(c.y);
  }, [clampTranslate]);

  // Wheel zoom (desktop)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0025;
      const next = stateRef.current.scale * (1 + delta * 4);
      zoomAt(next, e.clientX, e.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      pinchStart.current = {
        dist: Math.hypot(dx, dy),
        scale: stateRef.current.scale,
        cx: (pts[0].x + pts[1].x) / 2,
        cy: (pts[0].y + pts[1].y) / 2,
        tx: stateRef.current.tx,
        ty: stateRef.current.ty,
      };
      panStart.current = null;
    } else if (pointers.current.size === 1 && stateRef.current.scale > 1) {
      panStart.current = { x: e.clientX, y: e.clientY, tx: stateRef.current.tx, ty: stateRef.current.ty };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const pts = Array.from(pointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchStart.current.dist;
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchStart.current.scale * ratio));
      zoomAt(next, pinchStart.current.cx, pinchStart.current.cy);
    } else if (pointers.current.size === 1 && panStart.current) {
      const nx = panStart.current.tx + (e.clientX - panStart.current.x);
      const ny = panStart.current.ty + (e.clientY - panStart.current.y);
      const c = clampTranslate(nx, ny, stateRef.current.scale);
      setTx(c.x);
      setTy(c.y);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) {
      panStart.current = null;
      // double-tap detect
      const now = Date.now();
      if (now - lastTap.current < 280) {
        if (stateRef.current.scale > 1.05) reset();
        else zoomAt(2.5, e.clientX, e.clientY);
        lastTap.current = 0;
      } else {
        lastTap.current = now;
      }
    }
  };

  return (
    <div className={`relative w-full h-full ${className ?? ''}`}>
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden touch-none select-none flex items-center justify-center"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => {
          if (stateRef.current.scale > 1.05) reset();
          else zoomAt(2.5, e.clientX, e.clientY);
        }}
        style={{ cursor: scale > 1 ? 'grab' : 'zoom-in' }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-w-full max-h-full object-contain rounded-2xl pointer-events-none will-change-transform"
          style={{
            transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
            transition: pointers.current.size === 0 ? 'transform 120ms ease-out' : 'none',
            transformOrigin: 'center center',
          }}
        />
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-border/40 bg-background/80 backdrop-blur px-1.5 py-1 shadow-lg">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => {
            const el = containerRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            zoomAt(stateRef.current.scale - 0.5, r.left + r.width / 2, r.top + r.height / 2);
          }}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60"
        >
          <Minus size={14} />
        </button>
        <span className="text-[11px] tabular-nums w-10 text-center text-muted-foreground">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => {
            const el = containerRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            zoomAt(stateRef.current.scale + 0.5, r.left + r.width / 2, r.top + r.height / 2);
          }}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60"
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          aria-label="Reset zoom"
          onClick={reset}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60"
        >
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  );
};

export default ZoomableImage;
