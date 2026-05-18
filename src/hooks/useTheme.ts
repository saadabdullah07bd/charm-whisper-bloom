// Back-compat shim. The real theme system now lives in src/lib/theme.tsx.
// Existing callers only used `useTheme()` for mode and `useColorScheme()` is no-op.
import { useThemeFull, type ThemeMode } from '@/lib/theme';

export type { ThemeMode };
export type ColorScheme = string;
export const COLOR_SCHEMES: { key: ColorScheme; label: string; preview: string }[] = [];

/** Returns [mode, setMode] tuple for back-compat with existing call sites. */
export function useTheme(): readonly [ThemeMode, (m: ThemeMode) => void] {
  const { mode, setMode } = useThemeFull();
  return [mode, setMode] as const;
}

/** Deprecated — color scheme replaced by accent in new theme system. No-op for back-compat. */
export function useColorScheme(): readonly [ColorScheme, (s: ColorScheme) => void] {
  return ['default', () => {}] as const;
}
