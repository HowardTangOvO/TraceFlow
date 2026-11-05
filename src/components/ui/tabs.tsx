import Link from "next/link";
import { cn } from "@/lib/utils";

export interface TabItem {
  label: string;
  href: string;
  active?: boolean;
  count?: number;
}

/** 基于 URL 的 Tab（服务端渲染，无需客户端状态） */
export function TabLinks({ items, className }: { items: TabItem[]; className?: string }) {
  return (
    <nav className={cn("flex flex-wrap items-center gap-1 border-b border-border", className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "relative -mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
            item.active
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          {item.label}
          {typeof item.count === "number" ? (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                item.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {item.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
