import React from "react";
import medhelpMark from "@/assets/medhelp-mark.png";

interface Props {
  size?: number;
  label?: string;
  fullscreen?: boolean;
}

/**
 * Brand-matched loading spinner: pulsing MedHelp mark inside a rotating
 * conic-gradient ring. Uses the app's monochrome theme tokens.
 */
const BrandedSpinner: React.FC<Props> = ({ size = 72, label, fullscreen = false }) => {
  const ring = (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 rounded-full border border-primary/10" />
      <div
        className="absolute inset-0 rounded-full animate-spin"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, hsl(var(--primary) / 0.12) 90deg, hsl(var(--primary)) 170deg, transparent 260deg)",
          animationDuration: "0.95s",
          maskImage:
            "radial-gradient(circle, transparent 58%, #000 60%, #000 100%)",
          WebkitMaskImage:
            "radial-gradient(circle, transparent 58%, #000 60%, #000 100%)",
        }}
      />
      <div className="absolute inset-[18%] rounded-full bg-card shadow-lg" />
      <img
        src={medhelpMark}
        alt=""
        className="relative rounded-full animate-pulse"
        style={{
          width: size * 0.5,
          height: size * 0.5,
          animationDuration: "1.35s",
        }}
      />
    </div>
  );

  if (!fullscreen) return ring;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background gap-4 animate-fade-in">
      {ring}
      {label && (
        <p className="text-sm font-medium text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {label}
        </p>
      )}
    </div>
  );
};

export default BrandedSpinner;
