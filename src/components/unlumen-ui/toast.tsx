"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };

const ToastContext = createContext<(kind: ToastKind, message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const kindIcon: Record<ToastKind, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};

const kindClass: Record<ToastKind, string> = {
  success: "text-emerald-600 dark:text-emerald-300 border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/30",
  error: "text-rose-600 dark:text-rose-300 border-rose-200 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/30",
  info: "text-blue-600 dark:text-blue-300 border-blue-200 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/30",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-3), { id, kind, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} item={t} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ item }: { item: ToastItem }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      const anim = animate(ref.current, {
        translateX: [48, 0],
        opacity: [0, 1],
        duration: 380,
        ease: "outQuad",
      });
      return () => {
        anim.revert();
      };
    }
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "glass flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium",
        kindClass[item.kind]
      )}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
          kindClass[item.kind]
        )}
      >
        {kindIcon[item.kind]}
      </span>
      <span className="text-foreground">{item.message}</span>
    </div>
  );
}
