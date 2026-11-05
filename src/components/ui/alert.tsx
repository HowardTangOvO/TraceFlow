import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/constants";
import { LocalizedText } from "@/components/i18n/provider";

const TONE_STYLES: Record<string, { wrap: string; icon: ReactNode }> = {
  blue: {
    wrap: "border-blue-500/25 bg-blue-500/8 text-blue-700 dark:text-blue-300",
    icon: <Info className="size-4 shrink-0" />,
  },
  green: {
    wrap: "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
    icon: <CheckCircle2 className="size-4 shrink-0" />,
  },
  amber: {
    wrap: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    icon: <AlertTriangle className="size-4 shrink-0" />,
  },
  red: {
    wrap: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    icon: <XCircle className="size-4 shrink-0" />,
  },
  violet: {
    wrap: "border-violet-500/25 bg-violet-500/8 text-violet-700 dark:text-violet-300",
    icon: <ShieldAlert className="size-4 shrink-0" />,
  },
};

export function Alert({
  tone = "blue",
  title,
  children,
  className,
  icon,
}: {
  tone?: Tone | "gray";
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  const style = TONE_STYLES[tone] ?? TONE_STYLES.blue;
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-xs leading-5", style.wrap, className)}>
      {icon ?? style.icon}
      <div className="min-w-0">
        {title ? <div className="font-semibold">{title}</div> : null}
        {children ? <div className={cn("text-current/90", title && "mt-0.5")}>{children}</div> : null}
      </div>
    </div>
  );
}

/** 读取 URL 上的操作结果提示（配合 lib/actions 的 redirectWithSuccess/Error） */
export function ActionBanner({
  error,
  success,
}: {
  error?: string | string[] | null;
  success?: string | string[] | null;
}) {
  const errorText = Array.isArray(error) ? error[0] : error;
  const successText = Array.isArray(success) ? success[0] : success;
  if (!errorText && !successText) return null;
  return (
    <div className="mb-4 space-y-2">
      {errorText ? <Alert tone="red" title={<LocalizedText>Operation failed</LocalizedText>}><LocalizedText>{errorText}</LocalizedText></Alert> : null}
      {successText ? <Alert tone="green" title={<LocalizedText>Operation succeeded</LocalizedText>}><LocalizedText>{successText}</LocalizedText></Alert> : null}
    </div>
  );
}

/** 从 Next.js searchParams 中安全读取提示框参数 */
export function readActionMessages(searchParams?: Record<string, string | string[] | undefined>) {
  return {
    error: searchParams?.error,
    success: searchParams?.saved ?? searchParams?.success,
  };
}
