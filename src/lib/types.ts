/** 全领域实体类型（与 SQLite 表字段一一对应，snake_case） */

export type Role = "admin" | "pm" | "tech" | "test";

export type RequirementStatus = "draft" | "active" | "changed" | "deprecated";
export type Priority = "P0" | "P1" | "P2" | "P3";
export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done" | "blocked";
export type Dimension = "pm" | "tech" | "test";
export type CodeLayer = "frontend" | "backend" | "data" | "infra";
export type RiskLevel = "low" | "medium" | "high";
export type TestCaseType = "functional" | "regression" | "edge" | "integration" | "performance";
export type TestCaseStatus = "active" | "draft" | "deprecated";
export type TestResult = "pass" | "fail" | "blocked" | "skipped" | "not_run";
export type ChangeStatus = "draft" | "analyzing" | "pending_approval" | "approved" | "implemented" | "rejected";
export type ChangeType = "func_change" | "bug_fix" | "perf" | "tech_debt" | "compliance";
export type ImpactLevel = "low" | "medium" | "high";
export type ImpactAction = "modify" | "add" | "remove";
export type EffortSource = "rule" | "manual" | "history" | "llm";
export type Confidence = "low" | "medium" | "high";
export type SuggestionAction = "update" | "add" | "remove";
export type PlanStatus = "planned" | "running" | "completed" | "aborted";
export type MilestoneStatus = "planned" | "in_progress" | "done" | "at_risk";
export type DocCategory = "pm" | "tech" | "test" | "knowledge";
export type DocStatus = "published" | "draft";

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  title: string;
  avatar_color: string;
  password_hash: string;
  active: number;
  created_at: string;
  last_login_at: string | null;
}

/** 可安全暴露给客户端的用户信息（不含密码哈希） */
export type PublicUser = Omit<User, "password_hash">;

export interface Project {
  id: number;
  key: string;
  name: string;
  description: string;
  status: string;
  start_date: string | null;
  target_date: string | null;
  created_at: string;
}

export interface Milestone {
  id: number;
  project_id: number;
  name: string;
  description: string;
  target_date: string;
  status: MilestoneStatus;
  progress: number;
  created_at: string;
}

export interface Requirement {
  id: number;
  project_id: number;
  key: string;
  title: string;
  description_md: string;
  status: RequirementStatus;
  priority: Priority;
  owner_id: number | null;
  source: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  project_id: number;
  requirement_id: number | null;
  key: string;
  title: string;
  description_md: string;
  status: TaskStatus;
  dimension: Dimension;
  assignee_id: number | null;
  estimate_days: number;
  actual_days: number;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CodeModule {
  id: number;
  project_id: number;
  key: string;
  name: string;
  path: string;
  language: string;
  layer: CodeLayer;
  description_md: string;
  owner_id: number | null;
  loc: number;
  risk: RiskLevel;
  created_at: string;
  updated_at: string;
}

export interface TestCase {
  id: number;
  project_id: number;
  key: string;
  title: string;
  precondition_md: string;
  steps_md: string;
  expected_md: string;
  type: TestCaseType;
  priority: Priority;
  status: TestCaseStatus;
  automated: number;
  owner_id: number | null;
  last_result: TestResult;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChangeRequest {
  id: number;
  project_id: number;
  requirement_id: number | null;
  key: string;
  title: string;
  description_md: string;
  reason: string;
  change_type: ChangeType;
  status: ChangeStatus;
  risk_level: RiskLevel;
  affected_files: number;
  added_lines: number;
  removed_lines: number;
  auto_effort_days: number;
  final_effort_days: number | null;
  created_by: number | null;
  approved_by: number | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
}

export interface ChangeCodeImpact {
  id: number;
  change_request_id: number;
  code_module_id: number;
  impact_level: ImpactLevel;
  action: ImpactAction;
  reason: string;
  estimated_days: number;
}

export interface EffortBreakdownItem {
  label: string;
  days: number;
  note?: string;
}

export interface EffortEstimate {
  id: number;
  change_request_id: number;
  source: EffortSource;
  days: number;
  breakdown_json: string;
  confidence: Confidence;
  notes: string;
  created_by: number | null;
  created_at: string;
}

export interface TestChangeSuggestion {
  id: number;
  change_request_id: number;
  test_case_id: number;
  action: SuggestionAction;
  reason: string;
  priority: Priority;
  resolved: number;
  created_at: string;
}

export interface RegressionPlan {
  id: number;
  project_id: number;
  change_request_id: number | null;
  key: string;
  title: string;
  status: PlanStatus;
  scope_desc: string;
  created_by: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface RegressionPlanCase {
  id: number;
  plan_id: number;
  test_case_id: number;
  recommendation_score: number;
  reason: string;
  required: number;
}

export interface TestRun {
  id: number;
  plan_id: number;
  test_case_id: number;
  result: TestResult;
  executor_id: number | null;
  executed_at: string | null;
  notes: string;
  defect_ref: string;
}

export interface Document {
  id: number;
  project_id: number;
  title: string;
  slug: string;
  category: DocCategory;
  content_md: string;
  summary: string;
  status: DocStatus;
  version: number;
  author_id: number | null;
  related_requirement_id: number | null;
  related_code_module_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  summary: string;
  created_at: string;
}

/** 列表/详情页常用的富查询结果 */
export interface RequirementWithMeta extends Requirement {
  owner_name: string | null;
  task_count: number;
  done_task_count: number;
  code_count: number;
  test_count: number;
  change_count: number;
}

export interface TaskWithMeta extends Task {
  requirement_key: string | null;
  requirement_title: string | null;
  assignee_name: string | null;
  assignee_color: string | null;
}

export interface CodeModuleWithMeta extends CodeModule {
  owner_name: string | null;
  requirement_count: number;
  test_count: number;
}

export interface TestCaseWithMeta extends TestCase {
  owner_name: string | null;
  requirement_count: number;
  code_count: number;
}

export interface ChangeRequestWithMeta extends ChangeRequest {
  requirement_key: string | null;
  requirement_title: string | null;
  creator_name: string | null;
  approver_name: string | null;
  impact_count: number;
  estimate_count: number;
  suggestion_count: number;
}

export interface RegressionPlanWithMeta extends RegressionPlan {
  creator_name: string | null;
  change_key: string | null;
  total_cases: number;
  executed_cases: number;
  passed_cases: number;
  failed_cases: number;
}
