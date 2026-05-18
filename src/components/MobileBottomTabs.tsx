import { motion } from 'framer-motion';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface MobileTabItem<K extends string> {
  key: K;
  icon: React.ReactNode;
  label: string;
}

interface Props<K extends string> {
  tabs: MobileTabItem<K>[];
  activeKey: K;
  onChange: (key: K) => void;
}

/**
 * Apple-style glassy bottom tab bar with:
 *  - sliding indicator that follows finger drag
 *  - magnifier effect on the active/hovered icon
 *  - gloss highlight on the indicator while pressing
 */
export function MobileBottomTabs<K extends string>({ tabs, activeKey, onChange }: Props<K>) {
  const activeIndex = Math.max(0, tabs.findIndex(t => t.key === activeKey));

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [cellW, setCellW] = useState(0);
  const [pressing, setPressing] = useState(false);
  const [dragX, setDragX] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const pressingRef = useRef(false);
  const previewIndexRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const pointerOwnerRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setCellW(el.getBoundingClientRect().width / tabs.length);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tabs.length]);

  useEffect(() => { pressingRef.current = pressing; }, [pressing]);
  useEffect(() => { previewIndexRef.current = previewIndex; }, [previewIndex]);

  const getRelativeX = (clientX: number) => {
    if (!containerRef.current) return 0;
    const r = containerRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(r.width, clientX - r.left));
  };
  const getTouchingIndex = (rx: number) => {
    if (cellW === 0) return activeIndex;
    return Math.max(0, Math.min(tabs.length - 1, Math.floor(rx / cellW)));
  };

  const baseCenter = (i: number) => i * cellW + cellW / 2;
  const rawCenter = pressing && dragX != null ? dragX : baseCenter(activeIndex);
  const totalW = cellW * tabs.length;
  const idleW = Math.max(0, cellW - 10);
  const dragW = Math.min(cellW - 14, 68);
  const indicatorW = pressing ? dragW : idleW;
  const halfW = indicatorW / 2;
  const indicatorCenter = Math.max(halfW, Math.min(totalW - halfW, rawCenter));
  const hoverIndex = pressing ? (previewIndex ?? activeIndex) : activeIndex;

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>, _i: number) => {
    pointerOwnerRef.current = e.currentTarget;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setPressing(true);
    const rx = getRelativeX(e.clientX);
    setDragX(rx);
    const idx = getTouchingIndex(rx);
    previewIndexRef.current = idx;
    setPreviewIndex(idx);
    suppressClickRef.current = false;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pressingRef.current) return;
    const rx = getRelativeX(e.clientX);
    setDragX(rx);
    const idx = getTouchingIndex(rx);
    previewIndexRef.current = idx;
    suppressClickRef.current = true;
    setPreviewIndex(idx);
  };
  const onPointerFinish = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerOwnerRef.current?.hasPointerCapture?.(e.pointerId)) {
      pointerOwnerRef.current.releasePointerCapture?.(e.pointerId);
    }
    const target = previewIndexRef.current ?? activeIndex;
    setPressing(false);
    setPreviewIndex(null);
    previewIndexRef.current = null;
    setDragX(null);
    if (target !== activeIndex && target >= 0) onChange(tabs[target].key);
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 px-3"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
    >
      <div
        ref={containerRef}
        className="relative mx-auto max-w-md grid h-16 glass-header rounded-3xl border border-border/40"
        style={{
          gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
          boxShadow: '0 10px 40px -12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {cellW > 0 && (
          <motion.div
            aria-hidden
            className="absolute top-1.5 bottom-1.5 rounded-2xl pointer-events-none overflow-hidden"
            animate={{
              x: indicatorCenter - indicatorW / 2,
              y: pressing ? -5 : 0,
              width: indicatorW,
              scale: pressing ? 1.08 : 1,
            }}
            transition={
              pressing
                ? { type: 'spring', stiffness: 900, damping: 42, mass: 0.5 }
                : { type: 'spring', stiffness: 760, damping: 52, mass: 0.78 }
            }
            style={{
              left: 0,
              background: pressing
                ? 'color-mix(in oklab, hsl(var(--primary)) 28%, transparent)'
                : 'color-mix(in oklab, hsl(var(--primary)) 16%, transparent)',
              border: '1px solid color-mix(in oklab, hsl(var(--primary)) 36%, transparent)',
              backdropFilter: 'blur(18px) saturate(170%)',
              WebkitBackdropFilter: 'blur(18px) saturate(170%)',
              boxShadow: pressing
                ? '0 12px 32px -10px color-mix(in oklab, hsl(var(--primary)) 60%, transparent), inset 0 1px 0 rgba(255,255,255,0.45)'
                : 'inset 0 1px 0 rgba(255,255,255,0.20)',
            }}
          >
            {/* Apple-style gloss highlight */}
            <span
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background: pressing
                  ? 'linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.05) 38%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.20) 100%)'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%)',
                mixBlendMode: 'overlay',
              }}
            />
          </motion.div>
        )}

        {tabs.map((t, i) => {
          const hovered = i === hoverIndex;
          return (
            <button
              key={t.key}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (suppressClickRef.current) { suppressClickRef.current = false; return; }
                // Always notify parent — parent decides if a same-key click means
                // "go back to the hub root" (e.g. when on a sub-tab).
                onChange(t.key);
              }}
              onPointerDown={(e) => onPointerDown(e, i)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerFinish}
              onPointerCancel={onPointerFinish}
              style={{
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'none',
                userSelect: 'none',
              }}
              className="relative z-10 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium select-none"
              aria-current={hovered ? 'page' : undefined}
            >
              <motion.div
                animate={{
                  scale: hovered && pressing ? 1.32 : hovered ? 1.08 : 1,
                  y: hovered && pressing ? -2 : 0,
                }}
                transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                className={hovered ? 'text-primary' : 'text-muted-foreground'}
              >
                {t.icon}
              </motion.div>
              <motion.span
                animate={{ scale: hovered && pressing ? 1.1 : 1, y: hovered && pressing ? -1 : 0 }}
                transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                className={hovered ? 'text-primary font-semibold' : 'text-muted-foreground'}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {t.label}
              </motion.span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileBottomTabs;
