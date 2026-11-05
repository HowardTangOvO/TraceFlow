import { redirect } from "next/navigation";

/**
 * Server Action 通用约定：
 * - 成功：redirectWithSuccess(returnTo, "已保存")
 * - 失败：redirectWithError(returnTo, "原因")（页面用 <ActionBanner {...readActionMessages(searchParams)} /> 展示）
 * 注意：redirect 通过抛异常实现，不要把它包在 try/catch 里。
 */
export function redirectWithSuccess(returnTo: string, message = "操作成功"): never {
  redirect(withParam(returnTo, "saved", message));
}

export function redirectWithError(returnTo: string, message: string): never {
  redirect(withParam(returnTo, "error", message));
}

function withParam(path: string, key: string, value: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

/** 必填字段校验（抛出的错误会显示在错误边界/由调用方捕获） */
export function requiredText(value: FormDataEntryValue | null, label: string, maxLength = 2000): string {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`Required field: ${label}.`);
  if (text.length > maxLength) throw new Error(`${label} must be at most ${maxLength} characters.`);
  return text;
}

export function optionalText(value: FormDataEntryValue | null, maxLength = 20000): string {
  const text = String(value ?? "").trim();
  return text.slice(0, maxLength);
}

export function numeric(value: FormDataEntryValue | null, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function optionalId(value: FormDataEntryValue | null): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function formIds(formData: FormData, name: string): number[] {
  return formData
    .getAll(name)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}
