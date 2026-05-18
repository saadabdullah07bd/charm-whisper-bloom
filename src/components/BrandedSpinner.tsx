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
      {/* rotating ring */}
      <div
        className="absolute inset-0 rounded-full animate-spin"
        style={{
          background:
            "conic-gradient(from 0deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.05) 70%, hsl(var(--primary)) 100%)",
          animationDuration: "1.1s",
          maskImage:
            "radial-gradient(circle, transparent 58%, #000 60%, #000 100%)",
          WebkitMaskImage:
            "radial-gradient(circle, transparent 58%, #000 60%, #000 100%)",
        }}
      />
      {/* pulsing mark */}
      <img
        src={medhelpMark}
        alt=""
        className="relative rounded-full animate-pulse"
        style={{
          width: size * 0.55,
          height: size * 0.55,
          animationDuration: "1.6s",
        }}
      />
    </div>
  );

  if (!fullscreen) return ring;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background gap-4 animate-fade-in">
      {ring}
      {label && (
        <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {label}
        </p>
      )}
    </div>
  );
};

export default BrandedSpinner;
