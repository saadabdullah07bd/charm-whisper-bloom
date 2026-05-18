import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";
import { initNativeAuth } from "./lib/nativeAuth";
import { initPushNotifications } from "./lib/nativePush";
import SplashScreen from "./components/SplashScreen";

// Fire-and-forget native initialisers (no-ops on web).
initNativeAuth().catch((e) => console.warn("[nativeAuth init]", e));
initPushNotifications().catch((e) => console.warn("[push init]", e));

// Hide the native (Capacitor) splash as soon as our React splash is mounted,
// so the user sees a smooth handoff with no white flash.
if (Capacitor.isNativePlatform()) {
  import("@capacitor/splash-screen")
    .then(({ SplashScreen: NativeSplash }) =>
      NativeSplash.hide({ fadeOutDuration: 250 }),
    )
    .catch(() => {});
}

const Root = () => {
  const [splashDone, setSplashDone] = useState(false);
  return (
    <>
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
      <App />
    </>
  );
};

createRoot(document.getElementById("root")!).render(<Root />);
