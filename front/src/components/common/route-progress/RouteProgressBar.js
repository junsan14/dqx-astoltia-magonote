"use client";

import { useRouteProgress } from "./RouteProgressProvider";

export default function RouteProgressBar() {
  const { visible, progress } = useRouteProgress();

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "3px",
        zIndex: 99999,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: `${progress}%`,
          height: "100%",
          background: "linear-gradient(90deg, #3b82f6, #60a5fa, #93c5fd)",
          transition: "width 180ms ease",
          boxShadow: "0 0 8px rgba(59,130,246,0.5)",
        }}
      />
    </div>
  );
}