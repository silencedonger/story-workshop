"use client";

export default function LoadingAnimation() {
  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      {/* Central dot */}
      <div
        className="absolute w-3 h-3 rounded-full ink-dot"
        style={{ backgroundColor: "#2C2C2C" }}
      />
      {/* Spreading rings */}
      <div
        className="absolute w-12 h-12 rounded-full ink-spread"
        style={{
          border: "1.5px solid #B8977E",
          animationDelay: "0s",
        }}
      />
      <div
        className="absolute w-12 h-12 rounded-full ink-spread"
        style={{
          border: "1.5px solid #B8977E",
          animationDelay: "0.6s",
        }}
      />
      <div
        className="absolute w-12 h-12 rounded-full ink-spread"
        style={{
          border: "1.5px solid #B8977E",
          animationDelay: "1.2s",
        }}
      />
    </div>
  );
}
