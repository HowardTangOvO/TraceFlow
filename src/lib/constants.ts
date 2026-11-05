import type {
  ChangeStatus,
  ChangeType,
  CodeLayer,
  Confidence,
  Dimension,
  DocCategory,
  DocStatus,
  EffortSource,
  ImpactAction,
  ImpactLevel,
  MilestoneStatus,
  PlanStatus,
  Priority,
  RequirementStatus,
  RiskLevel,
  Role,
  SuggestionAction,
  TaskStatus,
  TestCaseStatus,
  TestCaseType,
  TestResult,
} from "./types";

export type Tone =
  | "gray"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "violet"
  | "cyan"
  | "orange"
  | "pink";

export interface Meta<T extends string> {
  label: string;
  tone: Tone;
  description?: string;
}

export const ROLE_META: Record<Role, Meta<Role>> = {
  admin: { label: "管理员", tone: "violet", description: "系统与用户管理，全部权限" },
  pm: { label: "产品经理", tone: "blue", description: "需求、排期、变更审批" },
  tech: { label: "研发", tone: "green", description: "代码模块、影响分析、工作量评估" },
  test: { label: "测试", tone: "amber", description: "测试用例、回归执行" },
};

export const DIMENSION_META: Record<Dimension, Meta<Dimension>> = {
  pm: { label: "产品", tone: "blue" },
  tech: { label: "研发", tone: "green" },
  test: { label: "测试", tone: "amber" },
};

export const REQUIREMENT_STATUS_META: Record<RequirementStatus, Meta<RequirementStatus>> = {
  draft: { label: "草稿", tone: "gray" },
  active: { label: "进行中", tone: "blue" },
  changed: { label: "变更中", tone: "amber" },
  deprecated: { label: "已废弃", tone: "red" },
};

export const PRIORITY_META: Record<Priority, Meta<Priority>> = {
  P0: { label: "P0 最高", tone: "red" },
  P1: { label: "P1 高", tone: "orange" },
  P2: { label: "P2 中", tone: "amber" },
  P3: { label: "P3 低", tone: "gray" },
};

export const TASK_STATUS_META: Record<TaskStatus, Meta<TaskStatus>> = {
  backlog: { label: "待规划", tone: "gray" },
  todo: { label: "待开始", tone: "cyan" },
  in_progress: { label: "进行中", tone: "blue" },
  review: { label: "待评审", tone: "violet" },
  done: { label: "已完成", tone: "green" },
  blocked: { label: "阻塞", tone: "red" },
};

/** 看板列顺序 */
export const TASK_BOARD_COLUMNS: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "done",
  "blocked",
];

export const CODE_LAYER_META: Record<CodeLayer, Meta<CodeLayer>> = {
  frontend: { label: "前端", tone: "cyan" },
  backend: { label: "后端", tone: "blue" },
  data: { label: "数据", tone: "violet" },
  infra: { label: "基础设施", tone: "gray" },
};

export const RISK_META: Record<RiskLevel, Meta<RiskLevel>> = {
  low: { label: "低风险", tone: "green" },
  medium: { label: "中风险", tone: "amber" },
  high: { label: "高风险", tone: "red" },
};

export const TEST_CASE_TYPE_META: Record<TestCaseType, Meta<TestCaseType>> = {
  functional: { label: "功能", tone: "blue" },
  regression: { label: "回归", tone: "violet" },
  edge: { label: "边界", tone: "amber" },
  integration: { label: "集成", tone: "cyan" },
  performance: { label: "性能", tone: "orange" },
};

export const TEST_CASE_STATUS_META: Record<TestCaseStatus, Meta<TestCaseStatus>> = {
  active: { label: "生效", tone: "green" },
  draft: { label: "草稿", tone: "gray" },
  deprecated: { label: "已废弃", tone: "red" },
};

export const TEST_RESULT_META: Record<TestResult, Meta<TestResult>> = {
  pass: { label: "通过", tone: "green" },
  fail: { label: "失败", tone: "red" },
  blocked: { label: "阻塞", tone: "amber" },
  skipped: { label: "跳过", tone: "gray" },
  not_run: { label: "未执行", tone: "gray" },
};

export const CHANGE_STATUS_META: Record<ChangeStatus, Meta<ChangeStatus>> = {
  draft: { label: "草稿", tone: "gray" },
  analyzing: { label: "影响分析中", tone: "blue" },
  pending_approval: { label: "待审批", tone: "amber" },
  approved: { label: "已批准", tone: "violet" },
  implemented: { label: "已上线", tone: "green" },
  rejected: { label: "已驳回", tone: "red" },
};

/** 变更流程阶段（用于进度条） */
export const CHANGE_PIPELINE: ChangeStatus[] = [
  "draft",
  "analyzing",
  "pending_approval",
  "approved",
  "implemented",
];

export const CHANGE_TYPE_META: Record<ChangeType, Meta<ChangeType>> = {
  func_change: { label: "功能变更", tone: "blue" },
  bug_fix: { label: "缺陷修复", tone: "red" },
  perf: { label: "性能优化", tone: "cyan" },
  tech_debt: { label: "技术债", tone: "gray" },
  compliance: { label: "合规调整", tone: "amber" },
};

export const IMPACT_LEVEL_META: Record<ImpactLevel, Meta<ImpactLevel>> = {
  low: { label: "低影响", tone: "green" },
  medium: { label: "中影响", tone: "amber" },
  high: { label: "高影响", tone: "red" },
};

export const IMPACT_ACTION_META: Record<ImpactAction, Meta<ImpactAction>> = {
  modify: { label: "修改", tone: "blue" },
  add: { label: "新增", tone: "green" },
  remove: { label: "移除", tone: "red" },
};

export const EFFORT_SOURCE_META: Record<EffortSource, Meta<EffortSource>> = {
  rule: { label: "规则引擎", tone: "blue" },
  manual: { label: "人工评估", tone: "violet" },
  history: { label: "历史校准", tone: "cyan" },
  llm: { label: "AI 辅助", tone: "amber" },
};

export const CONFIDENCE_META: Record<Confidence, Meta<Confidence>> = {
  low: { label: "低置信", tone: "red" },
  medium: { label: "中置信", tone: "amber" },
  high: { label: "高置信", tone: "green" },
};

export const SUGGESTION_ACTION_META: Record<SuggestionAction, Meta<SuggestionAction>> = {
  update: { label: "修改用例", tone: "orange" },
  add: { label: "新增用例", tone: "green" },
  remove: { label: "废弃用例", tone: "red" },
};

export const PLAN_STATUS_META: Record<PlanStatus, Meta<PlanStatus>> = {
  planned: { label: "已计划", tone: "gray" },
  running: { label: "执行中", tone: "blue" },
  completed: { label: "已完成", tone: "green" },
  aborted: { label: "已中止", tone: "red" },
};

export const MILESTONE_STATUS_META: Record<MilestoneStatus, Meta<MilestoneStatus>> = {
  planned: { label: "未开始", tone: "gray" },
  in_progress: { label: "进行中", tone: "blue" },
  done: { label: "已完成", tone: "green" },
  at_risk: { label: "有风险", tone: "red" },
};

export const DOC_CATEGORY_META: Record<DocCategory, Meta<DocCategory>> = {
  pm: { label: "产品知识", tone: "blue" },
  tech: { label: "技术知识", tone: "green" },
  test: { label: "测试知识", tone: "amber" },
  knowledge: { label: "通用知识", tone: "violet" },
};

export const DOC_STATUS_META: Record<DocStatus, Meta<DocStatus>> = {
  published: { label: "已发布", tone: "green" },
  draft: { label: "草稿", tone: "gray" },
};

/** 从 Meta map 生成下拉选项 */
export function metaOptions<T extends string>(map: Record<T, Meta<T>>): { value: T; label: string }[] {
  return (Object.keys(map) as T[]).map((value) => ({ value, label: map[value].label }));
}

export const AVATAR_COLORS = [
  "indigo",
  "blue",
  "emerald",
  "amber",
  "rose",
  "violet",
  "cyan",
  "orange",
] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];
