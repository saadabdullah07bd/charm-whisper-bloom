import * as React from "react";

export type ThemeMode = "system" | "light" | "dark";
export type ThemeAccent =
  | "slate" | "blue" | "emerald" | "violet" | "rose"
  | "amber" | "teal" | "sky" | "pink" | "lime" | "indigo";
export type ThemeGradient =
  | "aurora"
  | "sunset"
  | "ocean"
  | "lavender"
  | "peach"
  | "forest"
  | "midnight"
  | "none";
export type FontScale = "sm" | "md" | "lg";

interface ThemeState {
  mode: ThemeMode;
  accent: ThemeAccent;
  gradient: ThemeGradient;
  fontScale: FontScale;
  resolvedMode: "light" | "dark";
  setMode: (m: ThemeMode) => void;
  setAccent: (a: ThemeAccent) => void;
  setGradient: (g: ThemeGradient) => void;
  setFontScale: (s: FontScale) => void;
}

const ThemeContext = React.createContext<ThemeState | null>(null);

const STORAGE_KEY = "drmabari-theme";

interface Persisted {
  mode: ThemeMode;
  accent: ThemeAccent;
  gradient: ThemeGradient;
  fontScale: FontScale;
}

const DEFAULTS: Persisted = {
  mode: "system",
  accent: "slate",
  gradient: "aurora",
  fontScale: "md",
};

function readPersisted(): Persisted {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Persisted>) };
  } catch {
    return DEFAULTS;
  }
}

function applyDom(p: Persisted, systemDark: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const dark = p.mode === "dark" || (p.mode === "system" && systemDark);
  root.classList.toggle("dark", dark);
  root.dataset.accent = p.accent;
  root.dataset.gradient = p.gradient;
  root.dataset.fontScale = p.fontScale;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<Persisted>(() => readPersisted());
  const [systemDark, setSystemDark] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  React.useEffect(() => {
    applyDom(state, systemDark);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, systemDark]);

  const value: ThemeState = {
    ...state,
    resolvedMode:
      state.mode === "dark" || (state.mode === "system" && systemDark)
        ? "dark"
        : "light",
    setMode: (mode) => setState((s) => ({ ...s, mode })),
    setAccent: (accent) => setState((s) => ({ ...s, accent })),
    setGradient: (gradient) => setState((s) => ({ ...s, gradient })),
    setFontScale: (fontScale) => setState((s) => ({ ...s, fontScale })),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeFull(): ThemeState {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeFull must be used inside ThemeProvider");
  return ctx;
}

/** Inline script to apply theme before first paint (avoid flash). */
export const themeBootstrapScript = `
(function(){try{
  var raw=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
  var s=raw?JSON.parse(raw):{};
  var mode=s.mode||"system";
  var accent=s.accent||"slate";
  var gradient=s.gradient||"aurora";
  var scale=s.fontScale||"md";
  var sysDark=window.matchMedia("(prefers-color-scheme: dark)").matches;
  var dark=mode==="dark"||(mode==="system"&&sysDark);
  var r=document.documentElement;
  if(dark)r.classList.add("dark");else r.classList.remove("dark");
  r.dataset.accent=accent;
  r.dataset.gradient=gradient;
  r.dataset.fontScale=scale;
}catch(e){}})();
`;
