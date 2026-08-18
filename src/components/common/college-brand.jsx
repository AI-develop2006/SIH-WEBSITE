import { cn } from "@/lib/utils";

export function CollegeBrand({ className }) {
  return (
    <span className={cn("flex items-center shrink-0", className)}>
      <img
        src="/logo.png"
        alt="Sri Manakula Vinayagar Engineering College"
        className="h-10 sm:h-12 w-auto max-h-12 object-contain dark:brightness-110 dark:contrast-125"
      />
    </span>
  );
}
