import React, { useEffect, useState } from "react";
import medhelpLogo from "@/assets/medhelp-logo.png";

interface Props {
  onDone: () => void;
  /** Minimum visible duration in ms */
  duration?: number;
}

/**
 * Branded splash screen shown on app launch (web + native after the native
 * Capacitor splash hides). Logo zoom + fade, then exits with a soft fade.
 */
const SplashScreen: React.FC<Props> = ({ onDone, duration = 1400 }) => {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const leaveAt = window.setTimeout(() => setLeaving(true), duration);
    const doneAt = window.setTimeout(onDone, duration + 450);
    return () => {
      window.clearTimeout(leaveAt);
      window.clearTimeout(doneAt);
    };
  }, [duration, onDone]);

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className="flex flex-col items-center gap-6"
        style={{ animation: "splashIn 0.9s cubic-bezier(0.16, 1, 0.3, 1) both" }}
      >
        <div className="relative">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-30"
            style={{ background: "hsl(var(--primary))" }}
          />
          <img
            src={medhelpLogo}
            alt="MedHelp"
            className="relative w-28 h-28 rounded-3xl shadow-2xl"
          />
        </div>
        <h1
          className="text-2xl font-semibold tracking-tight text-foreground"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          MedHelp
        </h1>
        {/* slim progress bar */}
        <div className="w-32 h-1 rounded-full overflow-hidden bg-muted">
          <div
            className="h-full bg-primary"
            style={{ animation: "splashBar 1.3s ease-in-out both" }}
          />
        </div>
      </div>

      <style>{`
        @keyframes splashIn {
          0% { opacity: 0; transform: translateY(12px) scale(0.92); filter: blur(6px); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes splashBar {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
