import { useState } from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  label,
  error,
  type,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const actualType = isPassword ? (showPassword ? "text" : "password") : type;

  return (
    <label className="block w-full">
      {label && (
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      )}
      <div className="relative w-full">
        <input
          type={actualType}
          className={cn(
            "w-full rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus:border-ring/70 focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_18%,transparent)]",
            isPassword && "pr-11",
            error && "border-danger/70",
            className
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 transition-colors hover:text-foreground focus:outline-none"
            title={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-6.48a.75.75 0 0 0-.44-.82A10.22 10.22 0 0 0 10 2a10.22 10.22 0 0 0-5.83 1.838L3.28 2.22Zm1.69 3.81A8.73 8.73 0 0 0 1.76a.75.75 0 0 0-.44.82c.496 2.54 2.06 4.79 4.195 6.136L4.97 12.44A8.72 8.72 0 0 1 3.255 10a8.748 8.748 0 0 1 5.96-5.96L4.97 6.03ZM10 12.5a2.5 2.5 0 1 0-2.5-2.5l.006.166l2.328 2.328A2.47 2.47 0 0 0 10 12.5Zm2.78-2.78l1.457 1.457c.328-.718.513-1.513.513-2.351a6.25 6.25 0 0 0-6.25-6.25c-.838 0-1.633.185-2.35.513L7.607 4.544A7.75 7.75 0 0 1 10 3.75a7.75 7.75 0 0 1 7.75 7.75a7.73 7.73 0 0 1-.502 2.72l-1.458-1.457A6.22 6.22 0 0 0 12.78 9.72Z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.08.21.08.44 0 .65A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM10 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        )}
      </div>
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
