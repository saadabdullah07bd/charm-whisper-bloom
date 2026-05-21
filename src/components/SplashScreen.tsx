import React, { useEffect, useState } from "react";
import shiforaLogo from "@/assets/shifora-logo.png";

interface Props {
  onDone: () => void;
  /** Minimum visible duration in ms */
  duration?: number;
}

/** Minimal Shifora launch screen — logo, wordmark, gentle fade. */
const SplashScreen: React.FC<Props> = ({ onDone, duration = 900 }) => {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const leaveAt = window.setTimeout(() => setLeaving(true), duration);
    const doneAt = window.setTimeout(onDone, duration + 350);
    return () => {
      window.clearTimeout(leaveAt);
      window.clearTimeout(doneAt);
    };
  }, [duration, onDone]);

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-background transition-opacity duration-400 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-5 splash-rise">
        <img
          src={shiforaLogo}
          alt="Shifora"
          className="h-20 w-20 rounded-2xl"
          draggable={false}
        />
        <h1
          className="text-2xl font-medium tracking-tight text-foreground"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          Shifora
        </h1>
      </div>

      <style>{`
        .splash-rise { animation: splashRise 0.55s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes splashRise {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .splash-rise { animation: none !important; }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
