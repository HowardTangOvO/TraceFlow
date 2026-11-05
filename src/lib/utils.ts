import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { createTranslator, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 2026-11-04 */
export function formatDate(value: string | null | undefined, locale: Locale = DEFAULT_LOCALE): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** 11月04日 14:30 */
export function formatDateTime(value: string | null | undefined, locale: Locale = DEFAULT_LOCALE): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function timeAgo(value: string | null | undefined, locale: Locale = DEFAULT_LOCALE): string {
  if (!value) return "—";
  const d = new Date(value).getTime();
  if (Number.isNaN(d)) return value;
  const diff = Date.now() - d;
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) return createTranslator(locale)("Just now");
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const amount = (unit: number) => Math.floor(abs / unit) * (diff >= 0 ? -1 : 1);
  if (abs < hour) return relative.format(amount(minute), "minute");
  if (abs < day) return relative.format(amount(hour), "hour");
  if (abs < day * 30) return relative.format(amount(day), "day");
  return formatDate(value, locale);
}

export function formatDays(value: number | null | undefined, locale: Locale = DEFAULT_LOCALE): string {
  if (value === null || value === undefined) return "—";
  const rounded = Math.round(value * 10) / 10;
  return createTranslator(locale)("{days} person-days", { days: new Intl.NumberFormat(locale).format(rounded) });
}

export function percent(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return trimmed.slice(0, 2);
}

export function truncate(text: string, max = 120): string {
  const clean = text.replace(/[#*`>\-]/g, "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/** 读取字符串数组（用于表单多选），接受 FormData 中重复的 key */
export function formValues(formData: FormData, name: string): string[] {
  return formData.getAll(name).map((v) => String(v)).filter(Boolean);
}

export function firstValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export function numberValue(formData: FormData, name: string, fallback = 0): number {
  const raw = formData.get(name);
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
