/**
 * 数据库种子脚本
 *   pnpm db:seed    仅当数据库为空时灌入示例数据
 *   pnpm db:reset   删除数据库文件后重新灌入
 */
import { deleteDatabaseFiles, getDb, getDbPath } from "../src/lib/db/client";

const reset = process.argv.includes("--reset");

if (reset) {
  deleteDatabaseFiles();
  console.log(`[db] 已删除 ${getDbPath()}`);
}

const db = getDb();
const counts = ["users", "projects", "requirements", "tasks", "code_modules", "test_cases", "change_requests", "regression_plans", "documents", "audit_logs"].map(
  (table) => {
    const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number | bigint };
    return `${table}: ${row.c}`;
  },
);

console.log(`[db] ${getDbPath()}`);
console.log(counts.map((c) => `  - ${c}`).join("\n"));
console.log("[db] 完成。演示账号：admin@demo.dev/admin123, pm@demo.dev/pm123, tech@demo.dev/tech123, test@demo.dev/test123");
