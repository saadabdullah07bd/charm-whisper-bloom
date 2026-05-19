import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useThemeFull } from "@/lib/theme";

/**
 * Keeps the native Android status bar in sync with the resolved app theme.
 * Also enables immersive (overlay) mode so the WebView draws behind the
 * status bar — like a fullscreen native app. No-op on web.
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
        // Make the WebView draw behind the status bar (immersive look).
        try { await StatusBar.setOverlaysWebView({ overlay: true }); } catch { /* ignore */ }
        await StatusBar.setStyle({
          style: resolvedMode === "dark" ? Style.Dark : Style.Light,
        });
        if (Capacitor.getPlatform() === "android") {
          // Transparent so the app's background shows through.
          try { await StatusBar.setBackgroundColor({ color: "#00000000" }); } catch { /* ignore */ }
        }
      } catch {
        /* plugin not installed at runtime — ignore */
      }
    })();

    return () => { cancelled = true; };
  }, [resolvedMode]);

  return null;
}
