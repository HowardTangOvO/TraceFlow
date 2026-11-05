import { get } from "@/lib/db/client";

/** Backslashes are interpreted as slashes by browsers and must not escape local navigation. */
export function safeReturnTo(raw: FormDataEntryValue | null, fallback: string): string {
  const value = String(raw ?? "").trim();
  return /^\/(?!\/)/.test(value) && !/[\\\r\n]/.test(value) ? value : fallback;
}

export function activeUserId(raw: FormDataEntryValue | null): number | null {
  if (raw === null || raw === "") return null;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1 || !get("SELECT id FROM users WHERE id = ? AND active = 1", id)) {
    throw new Error("Select an active user.");
  }
  return id;
}

export function optionalEntityId(raw: FormDataEntryValue | null): number | null {
  if (raw === null || raw === "") return null;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Select a valid linked record.");
  return id;
}

export function personDays(raw: FormDataEntryValue | null): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error("Person-days must be a non-negative number.");
  return value;
}

export function dateInput(raw: FormDataEntryValue | null): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("Enter a valid date.");
  }
  return value;
}
