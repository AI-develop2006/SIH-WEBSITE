"use client";

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";

export function AuroraBackground() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const drift = animate(el.querySelectorAll("[data-orb]"), {
      translateX: [0, 70],
      translateY: [0, -50],
      scale: [1, 1.18],
      duration: 9000,
      direction: "alternate",
      loop: true,
      ease: "inOutSine",
      delay: stagger(1400),
    });

    const float = animate(el.querySelectorAll("[data-dot]"), {
      translateY: [0, -26],
      opacity: [0.25, 0.85],
      duration: 5200,
      direction: "alternate",
      loop: true,
      ease: "inOutQuad",
      delay: stagger(160),
    });

    return () => {
      drift.revert();
      float.revert();
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="bg-grid absolute inset-0" />
      <div
        data-orb
        className="absolute -top-24 left-[8%] size-[420px] rounded-full blur-[110px]"
        style={{ background: "radial-gradient(circle, var(--orb-a), transparent 70%)" }}
      />
      <div
        data-orb
        className="absolute top-[30%] right-[-6%] size-[460px] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, var(--orb-b), transparent 70%)" }}
      />
      <div
        data-orb
        className="absolute bottom-[-10%] left-[30%] size-[380px] rounded-full blur-[110px]"
        style={{ background: "radial-gradient(circle, var(--orb-c), transparent 70%)" }}
      />
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          data-dot
          className="absolute size-1 rounded-full bg-ring/60"
          style={{
            left: `${(i * 53) % 100}%`,
            top: `${(i * 37 + 12) % 100}%`,
          }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
    </div>
  );
}
