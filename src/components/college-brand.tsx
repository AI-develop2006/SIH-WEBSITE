import { cn } from "@/lib/utils";

export function CollegeBrand({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center", className)}>
      <img
        src="/logo.png"
        alt="Sri Manakula Vinayagar Engineering College"
        className="h-9 w-auto sm:h-11"
      />
    </span>
  );
}
