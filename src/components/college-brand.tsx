import { cn } from "@/lib/utils";

export function CollegeBrand({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center", className)}>
      <img
        src="/logo.png"
        alt="Sri Manakula Vinayagar Engineering College"
        className="h-12 w-auto dark:brightness-110 dark:contrast-125 sm:h-30"
      />
    </span>
  );
}
