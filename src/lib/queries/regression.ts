import { all, get } from "@/lib/db/client";
import type {
  ChangeStatus,
  ChangeType,
  PlanStatus,
  Priority,
  RegressionPlanWithMeta,
  RiskLevel,
  TestCaseStatus,
  TestCaseType,
  TestCaseWithMeta,
  TestResult,
} from "@/lib/types";

/** Test 维度查询层：回归计划（列表 / 详情 / 执行统计 / 用例清单 / 执行历史） */

export interface PlanListRow extends RegressionPlanWithMeta {
  change_title: string | null;
  change_status: ChangeStatus | null;
  requirement_id: number | null;
  requirement_key: string | null;
  requirement_title: string | null;
}

export interface RegressionPlanCaseRow {
  plan_case_id: number;
  recommendation_score: number;
  reason: string;
  required: number;
  test_case_id: number;
  key: string;
  title: string;
  type: TestCaseType;
  priority: Priority;
  case_status: TestCaseStatus;
  automated: number;
  last_result: TestResult;
  last_run_at: string | null;
  run_result: TestResult | null;
  run_executed_at: string | null;
  run_notes: string | null;
  run_defect_ref: string | null;
  executor_name: string | null;
  executor_color: string | null;
}

export interface PlanStats {
  total: number;
  executed: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  notRun: number;
  passRate: number;
  executeRate: number;
}

export interface PlanRunRow {
  id: number;
  test_case_id: number;
  case_key: string;
  case_title: string;
  result: TestResult;
  executor_name: string | null;
  executor_color: string | null;
  executed_at: string | null;
  notes: string;
  defect_ref: string;
}

export interface ChangeOption {
  id: number;
  key: string;
  title: string;
  status: ChangeStatus;
  change_type: ChangeType;
  risk_level: RiskLevel;
  requirement_id: number | null;
  requirement_key: string | null;
  requirement_title: string | null;
  impact_count: number;
}

const PLAN_COLUMNS = `
  p.*, u.name AS creator_name,
  c.key AS change_key, c.title AS change_title, c.status AS change_status,
  c.requirement_id AS requirement_id,
  r.key AS requirement_key, r.title AS requirement_title,
  (SELECT COUNT(*) FROM regression_plan_cases pc WHERE pc.plan_id = p.id) AS total_cases,
  (SELECT COUNT(*) FROM regression_plan_cases pc
     WHERE pc.plan_id = p.id AND (
       SELECT tr.result FROM test_runs tr
       WHERE tr.plan_id = p.id AND tr.test_case_id = pc.test_case_id
       ORDER BY tr.id DESC LIMIT 1
     ) <> 'not_run') AS executed_cases,
  (SELECT COUNT(*) FROM regression_plan_cases pc
     WHERE pc.plan_id = p.id AND (
       SELECT tr.result FROM test_runs tr
       WHERE tr.plan_id = p.id AND tr.test_case_id = pc.test_case_id
       ORDER BY tr.id DESC LIMIT 1
     ) = 'pass') AS passed_cases,
  (SELECT COUNT(*) FROM regression_plan_cases pc
     WHERE pc.plan_id = p.id AND (
       SELECT tr.result FROM test_runs tr
       WHERE tr.plan_id = p.id AND tr.test_case_id = pc.test_case_id
       ORDER BY tr.id DESC LIMIT 1
     ) = 'fail') AS failed_cases`;

/** 回归计划列表：执行中 → 已计划 → 已完成 → 已中止 */
export function listRegressionPlans(): PlanListRow[] {
  return all<PlanListRow>(
    `SELECT ${PLAN_COLUMNS}
     FROM regression_plans p
     LEFT JOIN users u ON u.id = p.created_by
     LEFT JOIN change_requests c ON c.id = p.change_request_id
     LEFT JOIN requirements r ON r.id = c.requirement_id
     ORDER BY CASE p.status WHEN 'running' THEN 0 WHEN 'planned' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,
       p.id DESC`,
  );
}

export function getRegressionPlanRow(id: number): PlanListRow | undefined {
  return get<PlanListRow>(
    `SELECT ${PLAN_COLUMNS}
     FROM regression_plans p
     LEFT JOIN users u ON u.id = p.created_by
     LEFT JOIN change_requests c ON c.id = p.change_request_id
     LEFT JOIN requirements r ON r.id = c.requirement_id
     WHERE p.id = ?`,
    id,
  );
}

/** 计划用例清单（含推荐分/理由与「本轮最新执行结果」） */
export function listPlanCases(planId: number): RegressionPlanCaseRow[] {
  return all<RegressionPlanCaseRow>(
    `SELECT pc.id AS plan_case_id, pc.recommendation_score, pc.reason, pc.required,
       tc.id AS test_case_id, tc.key, tc.title, tc.type, tc.priority, tc.status AS case_status,
       tc.automated, tc.last_result, tc.last_run_at,
       tr.result AS run_result, tr.executed_at AS run_executed_at,
       tr.notes AS run_notes, tr.defect_ref AS run_defect_ref,
       u.name AS executor_name, u.avatar_color AS executor_color
     FROM regression_plan_cases pc
     JOIN test_cases tc ON tc.id = pc.test_case_id
     LEFT JOIN test_runs tr ON tr.id = (
       SELECT MAX(id) FROM test_runs
       WHERE plan_id = pc.plan_id AND test_case_id = pc.test_case_id
     )
     LEFT JOIN users u ON u.id = tr.executor_id
     WHERE pc.plan_id = ?
     ORDER BY pc.recommendation_score DESC, tc.key ASC`,
    planId,
  );
}

/** 计划汇总统计（同一计划同一用例取最新一条执行记录） */
export function getPlanStats(planId: number): PlanStats {
  const row = get<{
    total: number;
    executed: number | null;
    passed: number | null;
    failed: number | null;
    blocked: number | null;
    skipped: number | null;
    not_run: number | null;
  }>(
    `SELECT COUNT(*) AS total,
       SUM(CASE WHEN r.result IN ('pass','fail','blocked','skipped') THEN 1 ELSE 0 END) AS executed,
       SUM(CASE WHEN r.result = 'pass' THEN 1 ELSE 0 END) AS passed,
       SUM(CASE WHEN r.result = 'fail' THEN 1 ELSE 0 END) AS failed,
       SUM(CASE WHEN r.result = 'blocked' THEN 1 ELSE 0 END) AS blocked,
       SUM(CASE WHEN r.result = 'skipped' THEN 1 ELSE 0 END) AS skipped,
       SUM(CASE WHEN r.result IS NULL OR r.result = 'not_run' THEN 1 ELSE 0 END) AS not_run
     FROM regression_plan_cases pc
     LEFT JOIN test_runs r ON r.id = (
       SELECT MAX(id) FROM test_runs tr
       WHERE tr.plan_id = pc.plan_id AND tr.test_case_id = pc.test_case_id
     )
     WHERE pc.plan_id = ?`,
    planId,
  );

  const total = Number(row?.total ?? 0);
  const executed = Number(row?.executed ?? 0);
  const passed = Number(row?.passed ?? 0);
  const failed = Number(row?.failed ?? 0);
  const blocked = Number(row?.blocked ?? 0);
  const skipped = Number(row?.skipped ?? 0);
  const notRun = Number(row?.not_run ?? 0);

  return {
    total,
    executed,
    passed,
    failed,
    blocked,
    skipped,
    notRun,
    passRate: executed > 0 ? Math.round((passed / executed) * 100) : 0,
    executeRate: total > 0 ? Math.round((executed / total) * 100) : 0,
  };
}

/** 计划执行记录（按执行时间倒序） */
export function listPlanRuns(planId: number): PlanRunRow[] {
  return all<PlanRunRow>(
    `SELECT tr.id, tr.test_case_id, tr.result, tr.executed_at, tr.notes, tr.defect_ref,
       tc.key AS case_key, tc.title AS case_title,
       u.name AS executor_name, u.avatar_color AS executor_color
     FROM test_runs tr
     JOIN test_cases tc ON tc.id = tr.test_case_id
     LEFT JOIN users u ON u.id = tr.executor_id
     WHERE tr.plan_id = ? AND tr.result <> 'not_run'
     ORDER BY COALESCE(tr.executed_at, '') DESC, tr.id DESC`,
    planId,
  );
}

/** 可加入计划的有效用例（未在当前计划中） */
export function listAvailableCases(planId: number): TestCaseWithMeta[] {
  return all<TestCaseWithMeta>(
    `SELECT tc.*, u.name AS owner_name,
       (SELECT COUNT(*) FROM test_case_requirement_links l WHERE l.test_case_id = tc.id) AS requirement_count,
       (SELECT COUNT(*) FROM test_case_code_links l WHERE l.test_case_id = tc.id) AS code_count
     FROM test_cases tc
     LEFT JOIN users u ON u.id = tc.owner_id
     WHERE tc.status = 'active'
       AND tc.id NOT IN (SELECT test_case_id FROM regression_plan_cases WHERE plan_id = ?)
     ORDER BY tc.key ASC`,
    planId,
  );
}

/** 新计划可用变更（全部变更，按状态优先级排序） */
export function listChangeOptions(): ChangeOption[] {
  return all<ChangeOption>(
    `SELECT c.id, c.key, c.title, c.status, c.change_type, c.risk_level,
       c.requirement_id, r.key AS requirement_key, r.title AS requirement_title,
       (SELECT COUNT(*) FROM change_code_impacts i WHERE i.change_request_id = c.id) AS impact_count
     FROM change_requests c
     LEFT JOIN requirements r ON r.id = c.requirement_id
     ORDER BY CASE c.status WHEN 'analyzing' THEN 0 WHEN 'approved' THEN 1 WHEN 'implemented' THEN 2
       WHEN 'pending_approval' THEN 3 ELSE 4 END, c.id DESC`,
  );
}

export function getChangeOption(id: number): ChangeOption | undefined {
  return get<ChangeOption>(
    `SELECT c.id, c.key, c.title, c.status, c.change_type, c.risk_level,
       c.requirement_id, r.key AS requirement_key, r.title AS requirement_title,
       (SELECT COUNT(*) FROM change_code_impacts i WHERE i.change_request_id = c.id) AS impact_count
     FROM change_requests c
     LEFT JOIN requirements r ON r.id = c.requirement_id
     WHERE c.id = ?`,
    id,
  );
}

/** 生成下一个计划编号：RP-004 */
export function nextPlanKey(): string {
  const rows = all<{ key: string }>("SELECT key FROM regression_plans");
  let max = 0;
  for (const row of rows) {
    const numeric = Number.parseInt(row.key.replace(/[^0-9]/g, ""), 10);
    if (Number.isFinite(numeric)) max = Math.max(max, numeric);
  }
  return `RP-${String(max + 1).padStart(3, "0")}`;
}

export function getPlanStatus(id: number): PlanStatus | undefined {
  return get<{ status: PlanStatus }>("SELECT status FROM regression_plans WHERE id = ?", id)?.status;
}
