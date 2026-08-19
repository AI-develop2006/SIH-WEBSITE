import { cn } from "@/lib/utils";

export function CollegeBrand({ className }) {
  return (
    <span className={cn("flex items-center shrink-0", className)}>
      <img
        src="/logo.png"
        alt="Sri Manakula Vinayagar Engineering College"
        className="h-9 sm:h-11 w-auto max-w-[160px] sm:max-w-none object-contain object-left dark:brightness-110 dark:contrast-125"
      />
    </span>
  );
}
