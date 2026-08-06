"use client";

// Theme is permanently dark — no toggling. Provider kept as a passthrough
// so existing imports don't break.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
