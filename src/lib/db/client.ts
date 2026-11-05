import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { DB, SqlValue } from "./db-types";
import { SCHEMA_SQL } from "./schema";
import { seedDatabase } from "./seed-data";

/**
 * SQLite 连接层（better-sqlite3）
 * - 单例连接，dev 模式 HMR 下通过 globalThis 复用
 * - 首次打开自动建表；库为空时自动灌入示例数据（开箱即用）
 */
type GlobalDb = typeof globalThis & {
  __pocWorkflowDb?: DB;
};

const globalDb = globalThis as GlobalDb;

export function getDbPath(): string {
  const configured = process.env.DB_PATH;
  if (configured) return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  return path.join(process.cwd(), "data", "app.db");
}

export function openDatabase(): DB {
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA_SQL);

  const row = db.prepare("SELECT COUNT(*) AS count FROM projects").get() as { count: number | bigint };
  if (Number(row.count) === 0) {
    seedDatabase(db);
  }
  return db;
}

export function getDb(): DB {
  if (!globalDb.__pocWorkflowDb) {
    globalDb.__pocWorkflowDb = openDatabase();
  }
  return globalDb.__pocWorkflowDb;
}

/** 关闭并清空单例（用于 db:reset 脚本） */
export function closeDb(): void {
  if (globalDb.__pocWorkflowDb) {
    try {
      globalDb.__pocWorkflowDb.close();
    } catch {
      // ignore
    }
    globalDb.__pocWorkflowDb = undefined;
  }
}

export function deleteDatabaseFiles(): void {
  closeDb();
  const dbPath = getDbPath();
  for (const suffix of ["", "-wal", "-shm"]) {
    const file = `${dbPath}${suffix}`;
    if (fs.existsSync(file)) fs.rmSync(file);
  }
}

export function all<T>(sql: string, ...params: SqlValue[]): T[] {
  const statement = getDb().prepare(sql);
  return statement.all(...params) as T[];
}

export function get<T>(sql: string, ...params: SqlValue[]): T | undefined {
  const statement = getDb().prepare(sql);
  return statement.get(...params) as T | undefined;
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export function run(sql: string, ...params: SqlValue[]): RunResult {
  const statement = getDb().prepare(sql);
  const result = statement.run(...params);
  return {
    changes: Number(result.changes ?? 0),
    lastInsertRowid: Number(result.lastInsertRowid ?? 0),
  };
}

/** 简单事务包装：同步函数内抛错自动回滚 */
export function tx<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore
    }
    throw error;
  }
}

export type { DB, SqlValue };
