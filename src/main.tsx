import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";
import { initNativeAuth } from "./lib/nativeAuth";
import { initPushNotifications } from "./lib/nativePush";

// Fire-and-forget native initialisers (no-ops on web).
initNativeAuth().catch((e) => console.warn("[nativeAuth init]", e));
initPushNotifications().catch((e) => console.warn("[push init]", e));

createRoot(document.getElementById("root")!).render(<App />);
