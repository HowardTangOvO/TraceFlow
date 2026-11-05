/** Keep shared test validation independent of browser and request context. */

export function formEnum<T extends string>(
  value: FormDataEntryValue | null,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = String(value ?? "").trim();
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

export function isChecked(value: FormDataEntryValue | null): boolean {
  const raw = String(value ?? "").toLowerCase();
  return raw === "on" || raw === "1" || raw === "true" || raw === "yes";
}

export function positiveId(value: FormDataEntryValue | null, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`Invalid identifier: ${label}.`);
  return parsed;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "The operation failed. Please try again.";
}
