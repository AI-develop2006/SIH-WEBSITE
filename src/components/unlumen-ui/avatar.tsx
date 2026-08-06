import { cn, initials } from "@/lib/utils";

const palettes = [
  "from-cyan-500/80 to-blue-600/80",
  "from-violet-500/80 to-fuchsia-600/80",
  "from-emerald-500/80 to-teal-600/80",
  "from-amber-500/80 to-orange-600/80",
  "from-rose-500/80 to-pink-600/80",
];

export function Avatar({
  name,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { name: string }) {
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const palette = palettes[hash % palettes.length];

  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white",
        palette,
        className
      )}
      title={name}
      {...props}
    >
      {initials(name)}
    </div>
  );
}
