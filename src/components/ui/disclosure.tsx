import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** 无 JS 折叠面板（用原生 details），用于「新建/编辑」表单等 */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className,
  tone = "default",
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  tone?: "default" | "primary";
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        "group rounded-xl border border-border bg-card",
        tone === "primary" && "border-primary/25 bg-primary/[0.03]",
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-medium text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
        {summary}
      </summary>
      <div className="border-t border-border px-4 py-4">{children}</div>
    </details>
  );
}
