import type { DB } from "./db-types";

export type SeedValue = string | number | bigint | null;

/** 通用单行插入，返回自增 id */
export function insertRow(db: DB, table: string, row: Record<string, SeedValue>): number {
  const keys = Object.keys(row);
  const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`;
  const info = db.prepare(sql).run(...keys.map((k) => row[k]));
  return Number(info.lastInsertRowid);
}

/** 按业务 key 反查 id（例如 REQ-001 -> 1） */
export function idByKey(db: DB, table: string, key: string): number {
  const row = db.prepare(`SELECT id FROM ${table} WHERE key = ?`).get(key) as { id: number | bigint } | undefined;
  if (!row) throw new Error(`seed: 找不到 ${table}.key=${key}`);
  return Number(row.id);
}

/** 相对当前时间偏移 N 天后的 ISO 时间（hour 本地时间） */
export function isoAt(offsetDays: number, hour = 10, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** 相对当前时间偏移 N 天后的日期 YYYY-MM-DD */
export function dateAt(offsetDays: number): string {
  return isoAt(offsetDays).slice(0, 10);
}

export function jsonText(value: unknown): string {
  return JSON.stringify(value);
}

export function assertSeeded(db: DB, table: string, expectedAtLeast: number): void {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number | bigint };
  if (Number(row.c) < expectedAtLeast) {
    throw new Error(`seed: ${table} 期望至少 ${expectedAtLeast} 行，实际 ${row.c}`);
  }
}
