import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/constants";

const TONE_BG: Record<Tone, string> = {
  gray: "bg-slate-400",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
  violet: "bg-violet-500",
  cyan: "bg-cyan-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
};

export function Progress({
  value,
  tone = "blue",
  className,
  showLabel = false,
  size = "md",
}: {
  value: number;
  tone?: Tone;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-muted",
          size === "sm" ? "h-1.5" : "h-2",
        )}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", TONE_BG[tone])}
          style={{ width: `${safe}%` }}
        />
      </div>
      {showLabel ? (
        <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{safe}%</span>
      ) : null}
    </div>
  );
}
