"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/constants";
import { useI18n } from "@/components/i18n/provider";

const TONE_CLASSES: Record<Tone, string> = {
  gray: "bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300 dark:ring-slate-400/20",
  blue: "bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-300 dark:ring-blue-400/25",
  green: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-400/25",
  amber: "bg-amber-500/10 text-amber-600 ring-amber-500/25 dark:text-amber-300 dark:ring-amber-400/25",
  red: "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-300 dark:ring-rose-400/25",
  violet: "bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-300 dark:ring-violet-400/25",
  cyan: "bg-cyan-500/10 text-cyan-600 ring-cyan-500/20 dark:text-cyan-300 dark:ring-cyan-400/25",
  orange: "bg-orange-500/10 text-orange-600 ring-orange-500/20 dark:text-orange-300 dark:ring-orange-400/25",
  pink: "bg-pink-500/10 text-pink-600 ring-pink-500/20 dark:text-pink-300 dark:ring-pink-400/25",
};

export interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
  title?: string;
}

export function Badge({ children, tone = "gray", dot = false, className, title }: BadgeProps) {
  const { t } = useI18n();
  return (
    <span
      title={title ? t(title) : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-5 ring-1 ring-inset",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current opacity-70" /> : null}
      {children}
    </span>
  );
}

/** 小组件：键值对标签 */
export function Tag({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
