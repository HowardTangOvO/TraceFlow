import type { ReactNode } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { controlClass } from "./form";

export const selectClass = cn(controlClass, "h-8 w-auto min-w-24 cursor-pointer py-0 pr-7 text-xs");

/** GET 表单筛选栏：子控件自备 name，提交后拼到 URL 上 */
export function FilterBar({
  action,
  children,
  className,
}: {
  action: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      action={action}
      method="get"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      <SlidersHorizontal className="size-3.5 text-muted-foreground" />
      {children}
    </form>
  );
}

export function SearchInput({
  name = "q",
  defaultValue = "",
  placeholder = "搜索关键词…",
  className,
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={cn(controlClass, "h-8 w-56 py-0 pl-8 text-xs")}
      />
    </div>
  );
}

export function SelectFilter({
  name,
  defaultValue = "",
  placeholder,
  options,
}: {
  name: string;
  defaultValue?: string;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select name={name} defaultValue={defaultValue} className={selectClass} aria-label={placeholder}>
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function FilterActions({ children }: { children?: ReactNode }) {
  return <div className="flex items-center gap-1.5">{children}</div>;
}
