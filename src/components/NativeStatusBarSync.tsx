import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useThemeFull } from "@/lib/theme";

/**
 * Keeps the native Android status bar in sync with the resolved app theme.
 * No-op on web. Safe to mount once near the root.
 */
export default function NativeStatusBarSync() {
  const { resolvedMode } = useThemeFull();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;

    (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        if (cancelled) return;
        await StatusBar.setStyle({
          style: resolvedMode === "dark" ? Style.Dark : Style.Light,
        });
        // Android only: match background to current theme surface.
        if (Capacitor.getPlatform() === "android") {
          await StatusBar.setBackgroundColor({
            color: resolvedMode === "dark" ? "#0a0a0a" : "#f7f7f7",
          });
        }
      } catch {
        /* plugin not installed at runtime — ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resolvedMode]);

  return null;
}
