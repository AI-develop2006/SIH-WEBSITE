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
  src,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { name: string; src?: string | null }) {
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const palette = palettes[hash % palettes.length];

  return (
    <div
      className={cn(
        "relative flex shrink-0 size-9 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white overflow-hidden",
        palette,
        className
      )}
      title={name}
      {...props}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="absolute inset-0 size-full object-cover"
          onError={(e) => {
            // hide broken image so initials show through
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : null}
      <span className={src ? "opacity-0" : ""}>{initials(name)}</span>
    </div>
  );
}
