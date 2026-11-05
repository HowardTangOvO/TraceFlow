import { cn } from "@/lib/utils";

export const CHART_COLORS = {
  primary: "#6366f1",
  violet: "#8b5cf6",
  blue: "#3b82f6",
  cyan: "#06b6d4",
  emerald: "#10b981",
  amber: "#f59e0b",
  orange: "#f97316",
  rose: "#f43f5e",
  slate: "#94a3b8",
} as const;

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

/** 纯 SVG 环形图（无第三方依赖） */
export function DonutChart({
  segments,
  size = 148,
  thickness = 14,
  centerValue,
  centerLabel,
  className,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerValue?: string | number;
  centerLabel?: string;
  className?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={thickness}
          className="text-muted"
        />
        {total > 0
          ? segments.map((segment) => {
              const fraction = segment.value / total;
              const dash = fraction * circumference;
              const circle = (
                <circle
                  key={segment.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += dash;
              return circle;
            })
          : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums leading-none text-foreground">
          {centerValue ?? total}
        </span>
        {centerLabel ? <span className="mt-1 text-[10px] text-muted-foreground">{centerLabel}</span> : null}
      </div>
    </div>
  );
}

/** 横向条形列表（分布/占比） */
export function BarList({
  items,
  className,
  showValue = true,
}: {
  items: { label: string; value: number; color?: string; hint?: string }[];
  className?: string;
  showValue?: boolean;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className={cn("space-y-2.5", className)}>
      {items.map((item) => (
        <div key={item.label} className="group">
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
            <span className="truncate text-muted-foreground">{item.label}</span>
            {showValue ? (
              <span className="shrink-0 tabular-nums font-medium text-foreground">
                {item.value}
                {item.hint ? <span className="ml-1 font-normal text-muted-foreground">{item.hint}</span> : null}
              </span>
            ) : null}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(item.value > 0 ? 3 : 0, (item.value / max) * 100)}%`,
                backgroundColor: item.color ?? CHART_COLORS.primary,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 极简趋势折线（近 N 天） */
export function Sparkline({
  values,
  height = 36,
  color = CHART_COLORS.primary,
  className,
}: {
  values: number[];
  height?: number;
  color?: string;
  className?: string;
}) {
  const width = 120;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((value, index) => `${index * step},${height - (value / max) * (height - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn("h-9 w-[120px] overflow-visible", className)} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
