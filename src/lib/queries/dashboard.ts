import { all, get } from "@/lib/db/client";
import type {
  AuditLog,
  ChangeRequestWithMeta,
  Dimension,
  Milestone,
  Project,
  RegressionPlanWithMeta,
  RequirementStatus,
  TaskStatus,
  TestResult,
} from "@/lib/types";

export interface DimensionSummary {
  dimension: Dimension;
  total: number;
  done: number;
  inProgress: number;
  estimateDays: number;
  actualDays: number;
}

export interface RiskItem {
  title: string;
  detail: string;
  tone: "amber" | "red" | "violet";
  href: string;
}

export interface DashboardData {
  project: Project;
  milestones: Milestone[];
  requirement: {
    total: number;
    active: number;
    changed: number;
    draft: number;
    deprecated: number;
  };
  task: {
    total: number;
    done: number;
    inProgress: number;
    review: number;
    todo: number;
    blocked: number;
    backlog: number;
    overdue: number;
    estimateDays: number;
    actualDays: number;
    byStatus: { status: TaskStatus; count: number }[];
    byDimension: DimensionSummary[];
  };
  change: {
    total: number;
    analyzing: number;
    pendingApproval: number;
    approved: number;
    implemented: number;
    activeEffortDays: number;
  };
  test: {
    total: number;
    active: number;
    automated: number;
    pass: number;
    fail: number;
    blocked: number;
    notRun: number;
    passRate: number;
  };
  plans: RegressionPlanWithMeta[];
  recentChanges: ChangeRequestWithMeta[];
  activity: (AuditLog & { user_name: string | null; avatar_color: string | null })[];
  risks: RiskItem[];
  docCount: number;
  codeModuleCount: number;
  coverage: { requirementCovered: number; codeCovered: number };
}

const num = (value: unknown): number => Number(value ?? 0);

export function getDashboardData(): DashboardData {
  const project = all<Project>("SELECT * FROM projects ORDER BY id LIMIT 1")[0];

  const milestones = all<Milestone>("SELECT * FROM milestones ORDER BY target_date ASC");

  const req = get<{
    total: number;
    active: number;
    changed: number;
    draft: number;
    deprecated: number;
  }>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active,
            COALESCE(SUM(CASE WHEN status = 'changed' THEN 1 ELSE 0 END), 0) AS changed,
            COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0) AS draft,
            COALESCE(SUM(CASE WHEN status = 'deprecated' THEN 1 ELSE 0 END), 0) AS deprecated
     FROM requirements`,
  );

  const task = get<{
    total: number;
    done: number;
    in_progress: number;
    review: number;
    todo: number;
    blocked: number;
    backlog: number;
    overdue: number;
    estimate: number;
    actual: number;
  }>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS done,
            COALESCE(SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END), 0) AS in_progress,
            COALESCE(SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END), 0) AS review,
            COALESCE(SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END), 0) AS todo,
            COALESCE(SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END), 0) AS blocked,
            COALESCE(SUM(CASE WHEN status = 'backlog' THEN 1 ELSE 0 END), 0) AS backlog,
            COALESCE(SUM(CASE WHEN status NOT IN ('done','blocked') AND due_date IS NOT NULL AND due_date < date('now') THEN 1 ELSE 0 END), 0) AS overdue,
            COALESCE(SUM(estimate_days), 0) AS estimate,
            COALESCE(SUM(actual_days), 0) AS actual
     FROM tasks`,
  );

  const byStatus = all<{ status: TaskStatus; count: number }>(
    "SELECT status, COUNT(*) AS count FROM tasks GROUP BY status",
  );

  const byDimension = all<DimensionSummary & Record<string, unknown>>(
    `SELECT dimension,
            COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS done,
            COALESCE(SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END), 0) AS inProgress,
            COALESCE(SUM(estimate_days), 0) AS estimateDays,
            COALESCE(SUM(actual_days), 0) AS actualDays
     FROM tasks GROUP BY dimension`,
  ).map((row) => ({
    dimension: row.dimension as Dimension,
    total: num(row.total),
    done: num(row.done),
    inProgress: num(row.inProgress),
    estimateDays: num(row.estimateDays),
    actualDays: num(row.actualDays),
  }));

  const change = get<{
    total: number;
    analyzing: number;
    pending: number;
    approved: number;
    implemented: number;
    effort: number;
  }>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN status = 'analyzing' THEN 1 ELSE 0 END), 0) AS analyzing,
            COALESCE(SUM(CASE WHEN status = 'pending_approval' THEN 1 ELSE 0 END), 0) AS pending,
            COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) AS approved,
            COALESCE(SUM(CASE WHEN status = 'implemented' THEN 1 ELSE 0 END), 0) AS implemented,
            COALESCE(SUM(CASE WHEN status IN ('analyzing','pending_approval','approved') THEN COALESCE(final_effort_days, auto_effort_days) ELSE 0 END), 0) AS effort
     FROM change_requests`,
  );

  const test = get<{
    total: number;
    active: number;
    automated: number;
    pass: number;
    fail: number;
    blocked: number;
    not_run: number;
  }>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active,
            COALESCE(SUM(CASE WHEN automated = 1 THEN 1 ELSE 0 END), 0) AS automated,
            COALESCE(SUM(CASE WHEN last_result = 'pass' THEN 1 ELSE 0 END), 0) AS pass,
            COALESCE(SUM(CASE WHEN last_result = 'fail' THEN 1 ELSE 0 END), 0) AS fail,
            COALESCE(SUM(CASE WHEN last_result = 'blocked' THEN 1 ELSE 0 END), 0) AS blocked,
            COALESCE(SUM(CASE WHEN last_result = 'not_run' THEN 1 ELSE 0 END), 0) AS not_run
     FROM test_cases WHERE status = 'active'`,
  );

  const plans = all<RegressionPlanWithMeta>(
    `SELECT p.*, u.name AS creator_name, c.key AS change_key,
            (SELECT COUNT(*) FROM regression_plan_cases pc WHERE pc.plan_id = p.id) AS total_cases,
            (SELECT COUNT(DISTINCT r.test_case_id) FROM test_runs r WHERE r.plan_id = p.id AND r.result != 'not_run') AS executed_cases,
            (SELECT COUNT(DISTINCT r.test_case_id) FROM test_runs r WHERE r.plan_id = p.id AND r.result = 'pass') AS passed_cases,
            (SELECT COUNT(DISTINCT r.test_case_id) FROM test_runs r WHERE r.plan_id = p.id AND r.result = 'fail') AS failed_cases
     FROM regression_plans p
     LEFT JOIN users u ON u.id = p.created_by
     LEFT JOIN change_requests c ON c.id = p.change_request_id
     ORDER BY p.created_at DESC`,
  );

  const recentChanges = all<ChangeRequestWithMeta>(
    `SELECT cr.*, r.key AS requirement_key, r.title AS requirement_title,
            cu.name AS creator_name, au.name AS approver_name,
            (SELECT COUNT(*) FROM change_code_impacts i WHERE i.change_request_id = cr.id) AS impact_count,
            (SELECT COUNT(*) FROM effort_estimates e WHERE e.change_request_id = cr.id) AS estimate_count,
            (SELECT COUNT(*) FROM test_change_suggestions s WHERE s.change_request_id = cr.id AND s.resolved = 0) AS suggestion_count
     FROM change_requests cr
     LEFT JOIN requirements r ON r.id = cr.requirement_id
     LEFT JOIN users cu ON cu.id = cr.created_by
     LEFT JOIN users au ON au.id = cr.approved_by
     ORDER BY cr.updated_at DESC LIMIT 5`,
  );

  const activity = all<AuditLog & { user_name: string | null; avatar_color: string | null }>(
    `SELECT a.*, u.name AS user_name, u.avatar_color AS avatar_color
     FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC LIMIT 8`,
  );

  const docCount = num(get<{ c: number }>("SELECT COUNT(*) AS c FROM documents")?.c);
  const codeModuleCount = num(get<{ c: number }>("SELECT COUNT(*) AS c FROM code_modules")?.c);
  const requirementCovered = num(
    get<{ c: number }>(
      "SELECT COUNT(DISTINCT requirement_id) AS c FROM test_case_requirement_links",
    )?.c,
  );
  const codeCovered = num(
    get<{ c: number }>("SELECT COUNT(DISTINCT code_module_id) AS c FROM test_case_code_links")?.c,
  );

  const risks: RiskItem[] = [];

  for (const milestone of milestones.filter((item) => item.status === "at_risk").slice(0, 2)) {
    risks.push({
      title: `Milestone at risk: ${milestone.name}`,
      detail: `Target ${milestone.target_date}, progress ${milestone.progress}%`,
      tone: "red",
      href: "/dashboard",
    });
  }

  const blockedTasks = all<{ key: string; title: string; assignee_name: string | null }>(
    `SELECT t.key, t.title, u.name AS assignee_name FROM tasks t
     LEFT JOIN users u ON u.id = t.assignee_id
     WHERE t.status = 'blocked' ORDER BY t.due_date LIMIT 2`,
  );
  for (const item of blockedTasks) {
    risks.push({
      title: `Blocked task: ${item.title}`,
      detail: `${item.key} · Owner ${item.assignee_name ?? "Unassigned"}`,
      tone: "amber",
      href: "/tasks",
    });
  }

  const failedCases = all<{ key: string; title: string; last_run_at: string | null }>(
    "SELECT key, title, last_run_at FROM test_cases WHERE last_result = 'fail' AND status = 'active' LIMIT 2",
  );
  for (const item of failedCases) {
    risks.push({
      title: `Failed test: ${item.title}`,
      detail: `${item.key} · Last executed ${item.last_run_at ?? "—"}`,
      tone: "red",
      href: "/tests",
    });
  }

  const pendingApprovals = all<{ key: string; title: string }>(
    "SELECT key, title FROM change_requests WHERE status = 'pending_approval' LIMIT 2",
  );
  for (const item of pendingApprovals) {
    risks.push({
      title: `Pending change: ${item.title}`,
      detail: `${item.key} · Awaiting PM approval`,
      tone: "violet",
      href: "/changes",
    });
  }

  const activeTestResults: TestResult[] = ["pass", "fail", "blocked", "not_run"];
  void activeTestResults;

  const passed = num(test?.pass);
  const activeTotal = num(test?.active);
  const passRate = activeTotal > 0 ? Math.round((passed / activeTotal) * 100) : 0;

  return {
    project,
    milestones,
    requirement: {
      total: num(req?.total),
      active: num(req?.active),
      changed: num(req?.changed),
      draft: num(req?.draft),
      deprecated: num(req?.deprecated),
    },
    task: {
      total: num(task?.total),
      done: num(task?.done),
      inProgress: num(task?.in_progress),
      review: num(task?.review),
      todo: num(task?.todo),
      blocked: num(task?.blocked),
      backlog: num(task?.backlog),
      overdue: num(task?.overdue),
      estimateDays: num(task?.estimate),
      actualDays: num(task?.actual),
      byStatus: byStatus.map((row) => ({ status: row.status, count: num(row.count) })),
      byDimension,
    },
    change: {
      total: num(change?.total),
      analyzing: num(change?.analyzing),
      pendingApproval: num(change?.pending),
      approved: num(change?.approved),
      implemented: num(change?.implemented),
      activeEffortDays: Math.round(num(change?.effort) * 10) / 10,
    },
    test: {
      total: num(test?.total),
      active: activeTotal,
      automated: num(test?.automated),
      pass: passed,
      fail: num(test?.fail),
      blocked: num(test?.blocked),
      notRun: num(test?.not_run),
      passRate,
    },
    plans,
    recentChanges,
    activity,
    risks: risks.slice(0, 4),
    docCount,
    codeModuleCount,
    coverage: {
      requirementCovered,
      codeCovered,
    },
  };
}

/** 需求状态分布（供小图使用） */
export function requirementStatusList(data: DashboardData): { status: RequirementStatus; count: number }[] {
  const counts: Record<string, number> = {
    active: data.requirement.active,
    changed: data.requirement.changed,
    draft: data.requirement.draft,
    deprecated: data.requirement.deprecated,
  };
  return Object.entries(counts).map(([status, count]) => ({ status: status as RequirementStatus, count }));
}
