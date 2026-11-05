import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/constants";

const TONE_ICON: Record<Tone, string> = {
  gray: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  red: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300",
  orange: "bg-orange-500/10 text-orange-600 dark:text-orange-300",
  pink: "bg-pink-500/10 text-pink-600 dark:text-pink-300",
};

export function StatCard({
  label,
  value,
  suffix,
  hint,
  icon,
  tone = "blue",
  href,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  suffix?: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  href?: string;
  className?: string;
}) {
  const body = (
    <div className={cn("surface group relative overflow-hidden p-4", href && "transition-colors hover:border-primary/30", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
        {icon ? (
          <div className={cn("flex size-8 items-center justify-center rounded-lg", TONE_ICON[tone])}>{icon}</div>
        ) : null}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</span>
        {suffix ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
      {hint ? <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div> : null}
      {href ? (
        <ArrowUpRight className="absolute right-3 top-3 size-3.5 text-muted-foreground/0 transition group-hover:text-muted-foreground/70" />
      ) : null}
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        {body}
      </Link>
    );
  }
  return body;
}
