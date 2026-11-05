import { cn, initials } from "@/lib/utils";
import { LocalizedText } from "@/components/i18n/provider";

const COLOR_CLASSES: Record<string, string> = {
  indigo: "bg-indigo-500/15 text-indigo-600 ring-indigo-500/25 dark:text-indigo-300",
  blue: "bg-blue-500/15 text-blue-600 ring-blue-500/25 dark:text-blue-300",
  emerald: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300",
  amber: "bg-amber-500/15 text-amber-600 ring-amber-500/25 dark:text-amber-300",
  rose: "bg-rose-500/15 text-rose-600 ring-rose-500/25 dark:text-rose-300",
  violet: "bg-violet-500/15 text-violet-600 ring-violet-500/25 dark:text-violet-300",
  cyan: "bg-cyan-500/15 text-cyan-600 ring-cyan-500/25 dark:text-cyan-300",
  orange: "bg-orange-500/15 text-orange-600 ring-orange-500/25 dark:text-orange-300",
};

const SIZE_CLASSES = {
  xs: "size-6 text-[10px]",
  sm: "size-7 text-[11px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
};

export function Avatar({
  name,
  color = "indigo",
  size = "md",
  className,
  title,
}: {
  name: string;
  color?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title ?? name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-inset",
        COLOR_CLASSES[color ?? "indigo"] ?? COLOR_CLASSES.indigo,
        SIZE_CLASSES[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function UserLabel({
  name,
  color,
  subtitle,
  size = "sm",
}: {
  name: string | null | undefined;
  color?: string | null;
  subtitle?: string | null;
  size?: keyof typeof SIZE_CLASSES;
}) {
  if (!name) return <span className="text-xs text-muted-foreground"><LocalizedText>Unassigned</LocalizedText></span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar name={name} color={color} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-foreground">{name}</span>
        {subtitle ? <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span> : null}
      </span>
    </span>
  );
}
