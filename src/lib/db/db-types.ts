import type BetterSqlite3 from "better-sqlite3";

/** better-sqlite3 数据库实例类型（独立文件避免循环依赖） */
export type DB = BetterSqlite3.Database;
export type SqlValue = string | number | bigint | Buffer | null;
