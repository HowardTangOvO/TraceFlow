import { all, get } from "@/lib/db/client";
import type {
  CodeLayer,
  Priority,
  RequirementStatus,
  RiskLevel,
  TestCaseStatus,
  TestCaseType,
  TestCaseWithMeta,
  TestResult,
} from "@/lib/types";

/** Test 维度查询层：测试用例库（列表 / 统计 / 详情 / 执行历史） */

export interface TestCaseFilters {
  q?: string;
  type?: string;
  status?: string;
  priority?: string;
  automated?: string;
  result?: string;
}

export interface TestCaseRequirementBrief {
  id: number;
  key: string;
  title: string;
  status: RequirementStatus;
  priority: Priority;
}

export interface TestCaseCodeBrief {
  id: number;
  key: string;
  name: string;
  path: string;
  layer: CodeLayer;
  risk: RiskLevel;
}

export interface TestCaseRunRow {
  id: number;
  plan_id: number;
  plan_key: string;
  plan_title: string;
  plan_status: string;
  result: TestResult;
  executor_name: string | null;
  executor_color: string | null;
  executed_at: string | null;
  notes: string;
  defect_ref: string;
}

export interface TestStats {
  total: number;
  active: number;
  draft: number;
  deprecated: number;
  automated: number;
  fail: number;
  blocked: number;
  notRun: number;
  requirementCovered: number;
  requirementTotal: number;
  byType: { type: TestCaseType; count: number }[];
  byResult: { result: TestResult; count: number }[];
}

export interface AttentionCase {
  id: number;
  key: string;
  title: string;
  priority: Priority;
  last_result: TestResult;
  last_run_at: string | null;
}

/** 用例列表（支持关键词 / 类型 / 状态 / 优先级 / 自动化 / 最近结果筛选） */
export function listTestCases(filters: TestCaseFilters = {}): TestCaseWithMeta[] {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (filters.q) {
    where.push("(tc.key LIKE ? OR tc.title LIKE ?)");
    const keyword = `%${filters.q}%`;
    params.push(keyword, keyword);
  }
  if (filters.type) {
    where.push("tc.type = ?");
    params.push(filters.type);
  }
  if (filters.status) {
    where.push("tc.status = ?");
    params.push(filters.status);
  }
  if (filters.priority) {
    where.push("tc.priority = ?");
    params.push(filters.priority);
  }
  if (filters.automated === "1" || filters.automated === "0") {
    where.push("tc.automated = ?");
    params.push(Number(filters.automated));
  }
  if (filters.result) {
    where.push("tc.last_result = ?");
    params.push(filters.result);
  }

  const sql = `
    SELECT tc.*, u.name AS owner_name,
      (SELECT COUNT(*) FROM test_case_requirement_links l WHERE l.test_case_id = tc.id) AS requirement_count,
      (SELECT COUNT(*) FROM test_case_code_links l WHERE l.test_case_id = tc.id) AS code_count
    FROM test_cases tc
    LEFT JOIN users u ON u.id = tc.owner_id
    ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY tc.key ASC`;

  return all<TestCaseWithMeta>(sql, ...params);
}

export function getTestCaseRow(id: number): TestCaseWithMeta | undefined {
  return get<TestCaseWithMeta>(
    `SELECT tc.*, u.name AS owner_name,
       (SELECT COUNT(*) FROM test_case_requirement_links l WHERE l.test_case_id = tc.id) AS requirement_count,
       (SELECT COUNT(*) FROM test_case_code_links l WHERE l.test_case_id = tc.id) AS code_count
     FROM test_cases tc
     LEFT JOIN users u ON u.id = tc.owner_id
     WHERE tc.id = ?`,
    id,
  );
}

/** 用例库统计：总数 / 生效 / 自动化率 / 失败 / 阻塞 / 需求覆盖 */
export function getTestStats(): TestStats {
  const base = get<{
    total: number;
    active: number;
    draft: number;
    deprecated: number;
    automated: number;
    fail: number;
    blocked: number;
    not_run: number;
  }>(
    `SELECT COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active,
       COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0) AS draft,
       COALESCE(SUM(CASE WHEN status = 'deprecated' THEN 1 ELSE 0 END), 0) AS deprecated,
       COALESCE(SUM(CASE WHEN automated = 1 AND status = 'active' THEN 1 ELSE 0 END), 0) AS automated,
       COALESCE(SUM(CASE WHEN last_result = 'fail' AND status = 'active' THEN 1 ELSE 0 END), 0) AS fail,
       COALESCE(SUM(CASE WHEN last_result = 'blocked' AND status = 'active' THEN 1 ELSE 0 END), 0) AS blocked,
       COALESCE(SUM(CASE WHEN last_result = 'not_run' AND status = 'active' THEN 1 ELSE 0 END), 0) AS not_run
     FROM test_cases`,
  );

  const coverage = get<{ covered: number }>(
    `SELECT COUNT(DISTINCT l.requirement_id) AS covered
     FROM test_case_requirement_links l
     JOIN test_cases tc ON tc.id = l.test_case_id
     WHERE tc.status = 'active'`,
  );
  const requirementTotal = get<{ count: number }>("SELECT COUNT(*) AS count FROM requirements");

  const byType = all<{ type: TestCaseType; count: number }>(
    `SELECT type, COUNT(*) AS count FROM test_cases WHERE status <> 'deprecated' GROUP BY type ORDER BY count DESC`,
  );
  const byResult = all<{ result: TestResult; count: number }>(
    "SELECT last_result AS result, COUNT(*) AS count FROM test_cases WHERE status = 'active' GROUP BY last_result",
  );

  return {
    total: Number(base?.total ?? 0),
    active: Number(base?.active ?? 0),
    draft: Number(base?.draft ?? 0),
    deprecated: Number(base?.deprecated ?? 0),
    automated: Number(base?.automated ?? 0),
    fail: Number(base?.fail ?? 0),
    blocked: Number(base?.blocked ?? 0),
    notRun: Number(base?.not_run ?? 0),
    requirementCovered: Number(coverage?.covered ?? 0),
    requirementTotal: Number(requirementTotal?.count ?? 0),
    byType,
    byResult,
  };
}

/** 待关注用例：最近失败 / 阻塞 */
export function listAttentionCases(limit = 6): AttentionCase[] {
  return all<AttentionCase>(
    `SELECT id, key, title, priority, last_result, last_run_at
     FROM test_cases
     WHERE status = 'active' AND last_result IN ('fail', 'blocked')
     ORDER BY CASE last_result WHEN 'fail' THEN 0 ELSE 1 END, COALESCE(last_run_at, '') DESC
     LIMIT ?`,
    limit,
  );
}

/** 用例关联的需求（用于详情页追溯） */
export function listCaseRequirements(testCaseId: number): TestCaseRequirementBrief[] {
  return all<TestCaseRequirementBrief>(
    `SELECT r.id, r.key, r.title, r.status, r.priority
     FROM test_case_requirement_links l
     JOIN requirements r ON r.id = l.requirement_id
     WHERE l.test_case_id = ?
     ORDER BY r.key ASC`,
    testCaseId,
  );
}

/** 用例关联的代码模块（用于详情页追溯） */
export function listCaseCodeModules(testCaseId: number): TestCaseCodeBrief[] {
  return all<TestCaseCodeBrief>(
    `SELECT m.id, m.key, m.name, m.path, m.layer, m.risk
     FROM test_case_code_links l
     JOIN code_modules m ON m.id = l.code_module_id
     WHERE l.test_case_id = ?
     ORDER BY m.key ASC`,
    testCaseId,
  );
}

/** 用例执行历史（test_runs join 回归计划 + 执行人） */
export function listCaseRuns(testCaseId: number): TestCaseRunRow[] {
  return all<TestCaseRunRow>(
    `SELECT tr.id, tr.result, tr.executed_at, tr.notes, tr.defect_ref,
       p.id AS plan_id, p.key AS plan_key, p.title AS plan_title, p.status AS plan_status,
       u.name AS executor_name, u.avatar_color AS executor_color
     FROM test_runs tr
     JOIN regression_plans p ON p.id = tr.plan_id
     LEFT JOIN users u ON u.id = tr.executor_id
     WHERE tr.test_case_id = ? AND tr.result <> 'not_run'
     ORDER BY COALESCE(tr.executed_at, '') DESC, tr.id DESC`,
    testCaseId,
  );
}

/** 生成下一个用例编号：TC-021 */
export function nextTestCaseKey(): string {
  const rows = all<{ key: string }>("SELECT key FROM test_cases");
  let max = 0;
  for (const row of rows) {
    const numeric = Number.parseInt(row.key.replace(/[^0-9]/g, ""), 10);
    if (Number.isFinite(numeric)) max = Math.max(max, numeric);
  }
  return `TC-${String(max + 1).padStart(3, "0")}`;
}

/** 案例库下拉（回归计划手动添加用例时使用） */
export function listActiveTestCaseOptions(): { id: number; key: string; title: string }[] {
  return all<{ id: number; key: string; title: string }>(
    "SELECT id, key, title FROM test_cases WHERE status = 'active' ORDER BY key ASC",
  );
}
