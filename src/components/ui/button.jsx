import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-[#c9a227] text-[#050b18] hover:bg-[#e8c058] shadow-sm",
  secondary: "bg-[rgba(147,197,253,0.08)] text-foreground hover:bg-[rgba(147,197,253,0.14)]",
  ghost: "text-[#94a3b8] hover:bg-[rgba(147,197,253,0.08)] hover:text-white",
  danger: "bg-red-500/90 text-white hover:bg-red-500",
  outline: "border border-[rgba(147,197,253,0.18)] bg-transparent text-foreground hover:border-[#c9a227]/40 hover:bg-[rgba(201,162,39,0.06)]",
};

export function Button({ variant = "primary", className, loading, disabled, children, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
        variants[variant] ?? variants.primary,
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}
