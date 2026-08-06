import { cn } from "@/lib/utils";

export function Input({
  className,
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
}) {
  return (
    <label className="block w-full">
      {label && (
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      )}
      <input
        className={cn(
          "w-full rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus:border-ring/70 focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_18%,transparent)]",
          error && "border-danger/70",
          className
        )}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

export function Select({
  className,
  label,
  error,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
}) {
  return (
    <label className="block w-full">
      {label && (
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      )}
      <select
        className={cn(
          "w-full appearance-none rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-sm text-foreground outline-none transition-all focus:border-ring/70 focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_18%,transparent)]",
          error && "border-danger/70",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}
