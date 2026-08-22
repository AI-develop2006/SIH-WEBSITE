import { createContext, useCallback, useContext, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

const kindClass = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  error:   "border-red-500/30   bg-red-500/10   text-red-300",
  info:    "border-blue-500/30  bg-blue-500/10  text-blue-300",
};
const kindIcon = { success: "✓", error: "✕", info: "ℹ" };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const push = useCallback((kind, message) => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-3), { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[9999] flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={cn("flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium backdrop-blur-sm", kindClass[t.kind])}>
            <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold", kindClass[t.kind])}>
              {kindIcon[t.kind]}
            </span>
            <span className="text-[#e8ecf7]">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
