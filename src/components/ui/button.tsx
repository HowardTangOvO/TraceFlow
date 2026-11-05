import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:bg-primary/95",
  secondary:
    "bg-muted text-foreground border border-border hover:bg-muted/70 active:bg-muted",
  outline:
    "border border-border bg-card text-foreground hover:bg-muted/60 active:bg-muted",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  danger: "bg-destructive text-white shadow-sm hover:bg-destructive/90",
  link: "text-primary underline-offset-4 hover:underline px-0 h-auto",
};

const SIZE: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-[11px] rounded-md gap-1",
  sm: "h-8 px-3 text-xs rounded-md gap-1.5",
  md: "h-9 px-4 text-sm rounded-lg gap-1.5",
  lg: "h-10 px-5 text-sm rounded-lg gap-2",
  icon: "size-9 rounded-lg",
};

const BASE =
  "inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors select-none disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background";

export function buttonStyles(options?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}): string {
  const { variant = "secondary", size = "md", className } = options ?? {};
  return cn(BASE, VARIANT[variant], SIZE[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ className, variant = "secondary", size = "md", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...props} />;
}
