"use client";

export function AuroraBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      {/* Grid Pattern Overlay with Radial Fade */}
      <div className="bg-grid absolute inset-0" />

      {/* Floating Glowing Orbs / Blobs at the screen edges */}
      {/* Orb 1: Soft Blue-Indigo on far left edge */}
      <div
        className="orb orb-float-1 absolute -top-[10vh] left-[-25vw] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] min-w-[280px] min-h-[280px]"
        style={{
          background: "radial-gradient(circle, var(--orb-a) 0%, rgba(59, 130, 246, 0) 70%)",
        }}
      />

      {/* Orb 2: Amber-Gold on far right edge */}
      <div
        className="orb orb-float-2 absolute top-[25vh] right-[-25vw] w-[45vw] h-[45vw] max-w-[500px] max-h-[500px] min-w-[240px] min-h-[240px]"
        style={{
          background: "radial-gradient(circle, var(--orb-b) 0%, rgba(245, 158, 11, 0) 70%)",
        }}
      />

      {/* Orb 3: Secondary Indigo on bottom-left screen edge */}
      <div
        className="orb orb-float-3 absolute bottom-[-15vh] left-[-15vw] w-[40vw] h-[40vw] max-w-[480px] max-h-[480px] min-w-[220px] min-h-[220px]"
        style={{
          background: "radial-gradient(circle, var(--orb-c) 0%, rgba(99, 102, 241, 0) 70%)",
        }}
      />
    </div>
  );
}

