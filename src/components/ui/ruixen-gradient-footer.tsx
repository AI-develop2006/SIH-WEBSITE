import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

export const RUIXEN_STOPS: [string, string, string] = ["#2563EB", "#7C3AED", "#DB2777"];

export interface RuixenGradientFooterProps {
  children?: ReactNode;
  gradientHeight?: string;
  minReveal?: number;
  bars?: number;
  blur?: number;
  peak?: number;
  valley?: number;
  stops?: [string, string, string];
  className?: string;
  style?: CSSProperties;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function RuixenGradientFooter({
  children,
  gradientHeight = "65vh",
  minReveal = 0.045,
  bars = 9,
  blur = 15,
  peak = 0.98,
  valley = 0.55,
  stops = RUIXEN_STOPS,
  className,
  style,
}: RuixenGradientFooterProps) {
  const gradientId = useId().replace(/[:]/g, "");
  const footerRef = useRef<HTMLElement | null>(null);
  const barRefs = useRef<(SVGRectElement | null)[]>([]);
  const [progress, setProgress] = useState(minReveal);
  const glowId = `${gradientId}_glow`;
  const gradId = `${gradientId}_grad`;

  const updateBars = useCallback(
    (rect: DOMRect) => {
      const vh = window.innerHeight;
      for (let i = 0; i < bars; i++) {
        const bar = barRefs.current[i];
        if (!bar) continue;
        const t = clamp01(1 - rect.top / vh);
        const y = lerp(peak, valley, t);
        bar.setAttribute("y", `${y * 100}%`);
        bar.setAttribute("height", `${(1 - y) * 100}%`);
      }
    },
    [bars, peak, valley]
  );

  const handleScroll = useCallback(() => {
    const el = footerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const hidden = clamp01(rect.top / vh);
    setProgress(Math.max(minReveal, 1 - hidden));
    updateBars(rect);
  }, [minReveal, updateBars]);

  useEffect(() => {
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [handleScroll]);

  const scaleY = Math.max(minReveal, progress);

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-0 flex justify-center"
        style={{ height: gradientHeight }}
      >
        <div
          className="h-full w-full overflow-hidden"
          style={{
            filter: `blur(${blur}px)`,
            transform: `scaleY(${scaleY})`,
            transformOrigin: "bottom center",
          }}
        >
          <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={stops[0]} />
                <stop offset="50%" stopColor={stops[1]} />
                <stop offset="100%" stopColor={stops[2]} />
              </linearGradient>
              <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation={blur} />
              </filter>
            </defs>
            <g filter={`url(#${glowId})`} fill={`url(#${gradId})`}>
              {Array.from({ length: bars }).map((_, i) => (
                <rect
                  key={i}
                  ref={(el) => {
                    barRefs.current[i] = el;
                  }}
                  x={i * (100 / bars)}
                  y={peak * 100}
                  width={100 / bars}
                  height="2.5%"
                />
              ))}
            </g>
          </svg>
        </div>
      </div>

      <footer
        ref={footerRef}
        className={`relative w-full ${className ?? ""}`}
        style={{ paddingBottom: gradientHeight, ...style }}
      >
        <div className="relative z-10">{children}</div>
      </footer>
    </>
  );
}
