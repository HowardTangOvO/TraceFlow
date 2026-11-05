import type { DB } from "./db-types";
import { seedCore } from "./seed-core";
import { seedDocuments, seedAuditLogs } from "./seed-docs";
import { seedChangeAnalysis, seedChanges, seedCodeModules, seedTestSuggestions } from "./seed-tech";
import { seedRegressionPlans, seedTestCases } from "./seed-test";

/**
 * 灌入完整示例项目数据（幂等：由调用方保证只在空库时执行）。
 * 顺序：核心 → 代码 → 用例 → 变更 → 影响分析 → 用例修改建议 → 回归 → 文档 → 审计
 */
export function seedDatabase(db: DB): void {
  const startedAt = Date.now();
  db.exec("BEGIN");
  try {
    seedCore(db);
    seedCodeModules(db);
    seedTestCases(db);
    seedChanges(db);
    seedChangeAnalysis(db);
    seedTestSuggestions(db);
    seedRegressionPlans(db);
    seedDocuments(db);
    seedAuditLogs(db);
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore
    }
    throw error;
  }

  const counts = ["users", "requirements", "tasks", "code_modules", "test_cases", "change_requests", "regression_plans", "documents"]
    .map((table) => {
      const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number | bigint };
      return `${table}=${row.c}`;
    })
    .join(" ");
  console.info(`[seed] 示例数据已就绪（${Date.now() - startedAt}ms）：${counts}`);
}
