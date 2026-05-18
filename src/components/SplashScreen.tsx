import React, { useEffect, useState } from "react";
import medhelpLogo from "@/assets/medhelp-logo.png";
import medhelpMark from "@/assets/medhelp-mark.png";

interface Props {
  onDone: () => void;
  /** Minimum visible duration in ms */
  duration?: number;
}

/** Premium MedHelp launch screen with ECG scan motion and theme-aware surfaces. */
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
      className={`fixed inset-0 z-[200] overflow-hidden bg-background transition-opacity duration-500 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="absolute inset-0 opacity-[0.18] splash-grid" />
      <div className="absolute inset-x-0 top-1/2 h-px bg-border/70" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
        <div className="relative flex h-60 w-60 items-center justify-center sm:h-72 sm:w-72">
          <div className="absolute inset-0 rounded-full border border-primary/10 splash-orbit" />
          <div className="absolute inset-6 rounded-full border border-primary/15 splash-orbit splash-orbit-delay" />
          <div className="absolute h-44 w-44 rounded-full bg-primary/5 blur-3xl" />

          <div className="absolute inset-x-3 top-1/2 h-16 -translate-y-1/2 overflow-hidden">
            <svg className="splash-ecg h-full w-[540px]" viewBox="0 0 540 64" aria-hidden="true">
              <path
                d="M0 33 H80 L94 33 L104 21 L116 45 L130 10 L145 53 L160 33 H238 L250 33 L260 24 L272 42 L287 15 L302 50 L318 33 H410 L422 33 L432 25 L444 41 L460 19 L476 48 L492 33 H540"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
            </svg>
          </div>

          <div className="relative flex h-32 w-32 items-center justify-center rounded-[2rem] border border-border bg-card/90 shadow-2xl backdrop-blur-xl splash-logo-card">
            <div className="absolute inset-0 rounded-[2rem] bg-primary/5" />
            <img src={medhelpLogo} alt="MedHelp" className="relative h-24 w-24 rounded-2xl" />
            <img src={medhelpMark} alt="" className="absolute -right-3 -top-3 h-9 w-9 rounded-full border border-border bg-background p-1 shadow-lg splash-mark" />
          </div>
        </div>

        <div className="-mt-2 flex flex-col items-center gap-5 splash-copy">
          <h1
            className="text-3xl font-semibold tracking-normal text-foreground"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            MedHelp
          </h1>
          <div className="h-1.5 w-44 overflow-hidden rounded-full bg-muted shadow-inner">
            <div className="h-full rounded-full bg-primary splash-progress" />
          </div>
        </div>
      </div>

      <style>{`
        .splash-grid {
          background-image:
            linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px);
          background-size: 34px 34px;
          mask-image: radial-gradient(circle at center, #000 0%, transparent 68%);
        }
        .splash-logo-card { animation: splashRise 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .splash-copy { animation: splashRise 0.75s 0.12s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .splash-orbit { animation: splashOrbit 4.8s linear infinite; }
        .splash-orbit-delay { animation-duration: 6.2s; animation-direction: reverse; }
        .splash-orbit::after,
        .splash-orbit-delay::after {
          content: "";
          position: absolute;
          left: 50%;
          top: -5px;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: hsl(var(--primary));
          box-shadow: 0 0 24px hsl(var(--primary) / 0.45);
        }
        .splash-ecg { animation: splashEcg 1.35s ease-in-out both; filter: drop-shadow(0 0 12px hsl(var(--primary) / 0.28)); }
        .splash-mark { animation: splashPulse 1.4s ease-in-out infinite; }
        .splash-progress { animation: splashBar 1.35s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes splashRise {
          0% { opacity: 0; transform: translateY(18px) scale(0.9); filter: blur(8px); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes splashOrbit {
          to { transform: rotate(360deg); }
        }
        @keyframes splashEcg {
          0% { transform: translateX(-260px); opacity: 0; }
          18% { opacity: 1; }
          100% { transform: translateX(18px); opacity: 0.75; }
        }
        @keyframes splashBar {
          0% { width: 0%; transform: translateX(-20%); }
          100% { width: 100%; }
        }
        @keyframes splashPulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .splash-logo-card, .splash-copy, .splash-orbit, .splash-orbit-delay, .splash-ecg, .splash-mark, .splash-progress {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
