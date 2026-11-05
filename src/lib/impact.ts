/**
 * 变更影响分析规则引擎（纯函数，不直接读写数据库）
 *
 * 输入：
 * - 变更申请（类型 / 风险 / 代码改动量 / 关联需求）
 * - 需求-代码追溯关系（requirement_code_links）解析出的模块清单
 * - 受影响模块 / 需求的测试用例覆盖关系
 * 输出：
 * - 受影响模块候选（影响等级 / 动作 / 预估人天 / 判定理由）
 * - 测试用例修改建议候选（update / add / remove，带优先级与理由）
 *
 * 规则可解释：模块风险 × 代码层 × 变更风险 × 变更类型，人天按影响等级与模块规模折算。
 */
import {
  CHANGE_TYPE_META,
  CODE_LAYER_META,
  IMPACT_LEVEL_META,
  RISK_META,
} from "@/lib/constants";
import type {
  ChangeRequest,
  ChangeType,
  CodeLayer,
  CodeModule,
  ImpactAction,
  ImpactLevel,
  Priority,
  RiskLevel,
  SuggestionAction,
  TestCaseStatus,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* 影响分析                                                                     */
/* -------------------------------------------------------------------------- */

export interface ImpactCandidate {
  code_module_id: number;
  impact_level: ImpactLevel;
  action: ImpactAction;
  estimated_days: number;
  reason: string;
}

const RISK_SCORE: Record<RiskLevel, number> = { low: 1.1, medium: 1.8, high: 2.6 };
const LAYER_SCORE: Record<CodeLayer, number> = { frontend: 0.95, backend: 1, data: 1.1, infra: 0.85 };
const CHANGE_RISK_SCORE: Record<RiskLevel, number> = { low: 0.85, medium: 1, high: 1.2 };
const CHANGE_TYPE_SCORE: Record<ChangeType, number> = {
  func_change: 1.1,
  bug_fix: 0.95,
  perf: 0.95,
  tech_debt: 1.05,
  compliance: 1,
};
const IMPACT_BASE_DAYS: Record<ImpactLevel, number> = { low: 0.5, medium: 1, high: 2 };
const IMPACT_WEIGHT: Record<ImpactLevel, number> = { low: 1, medium: 2, high: 3 };
const PRIORITY_RANK: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
const IMPACT_PRIORITY: Record<ImpactLevel, Priority> = { high: "P0", medium: "P1", low: "P2" };

/** 预估人天取 0.5 人天粒度，最小 0.5 */
function roundHalf(value: number): number {
  return Math.max(0.5, Math.round(value * 2) / 2);
}

/** 综合变更类型 / 风险与模块属性计算影响等级 */
export function scoreImpactLevel(change: ChangeRequest, module: CodeModule): ImpactLevel {
  const score =
    RISK_SCORE[module.risk] *
    LAYER_SCORE[module.layer] *
    CHANGE_RISK_SCORE[change.risk_level] *
    CHANGE_TYPE_SCORE[change.change_type];
  if (score >= 2.6) return "high";
  if (score >= 1.7) return "medium";
  return "low";
}

/**
 * 规则引擎：根据变更关联需求的「需求-代码追溯关系」生成受影响模块候选。
 * 同一变更重新分析时按 (change_request_id, code_module_id) 幂等写入。
 */
export function analyzeChangeImpact(
  change: ChangeRequest,
  modules: CodeModule[],
  requirementKey: string | null,
): ImpactCandidate[] {
  return modules
    .map((module) => {
      const impactLevel = scoreImpactLevel(change, module);
      const estimatedDays = roundHalf(IMPACT_BASE_DAYS[impactLevel] * (0.4 + module.loc / 8000));
      return {
        code_module_id: module.id,
        impact_level: impactLevel,
        action: "modify" as const,
        estimated_days: estimatedDays,
        reason:
          `规则引擎：${CODE_LAYER_META[module.layer].label}层 ${RISK_META[module.risk].label}模块` +
          `（${module.loc} LOC）与需求 ${requirementKey ?? "—"} 存在追溯关系，` +
          `结合「${CHANGE_TYPE_META[change.change_type].label}」变更判定为${IMPACT_LEVEL_META[impactLevel].label}。`,
      };
    })
    .sort(
      (a, b) =>
        IMPACT_WEIGHT[b.impact_level] - IMPACT_WEIGHT[a.impact_level] ||
        b.estimated_days - a.estimated_days,
    );
}

/* -------------------------------------------------------------------------- */
/* 测试用例修改建议                                                              */
/* -------------------------------------------------------------------------- */

export interface ImpactedModuleTest {
  test_case_id: number;
  test_key: string;
  test_title: string;
  test_priority: Priority;
  test_status: TestCaseStatus;
  module_key: string;
  module_name: string;
  impact_level: ImpactLevel;
}

export interface RequirementTestCase {
  test_case_id: number;
  test_key: string;
  test_title: string;
  test_priority: Priority;
  test_status: TestCaseStatus;
}

export interface TestSuggestionCandidate {
  test_case_id: number;
  action: SuggestionAction;
  reason: string;
  priority: Priority;
}

function worsePriority(a: Priority, b: Priority): Priority {
  return PRIORITY_RANK[a] <= PRIORITY_RANK[b] ? a : b;
}

/**
 * 测试用例修改建议规则：
 * - 受影响模块已覆盖的用例 → update（优先级取用例原优先级与影响等级的更严者）
 * - 已废弃但仍挂载在受影响模块上的用例 → remove
 * - 仅关联需求、但未覆盖受影响模块的用例 → add（补充覆盖）
 * 同一用例只保留一条建议。
 */
export function buildTestChangeSuggestions(input: {
  moduleTests: ImpactedModuleTest[];
  requirementTests: RequirementTestCase[];
  requirementKey: string | null;
}): TestSuggestionCandidate[] {
  interface Aggregate {
    testCaseId: number;
    testKey: string;
    testTitle: string;
    testPriority: Priority;
    testStatus: TestCaseStatus;
    modules: string[];
    maxImpact: ImpactLevel;
  }

  const merged = new Map<number, Aggregate>();
  for (const item of input.moduleTests) {
    const label = `${item.module_key} ${item.module_name}`;
    const existing = merged.get(item.test_case_id);
    if (!existing) {
      merged.set(item.test_case_id, {
        testCaseId: item.test_case_id,
        testKey: item.test_key,
        testTitle: item.test_title,
        testPriority: item.test_priority,
        testStatus: item.test_status,
        modules: [label],
        maxImpact: item.impact_level,
      });
      continue;
    }
    if (!existing.modules.includes(label)) existing.modules.push(label);
    if (IMPACT_WEIGHT[item.impact_level] > IMPACT_WEIGHT[existing.maxImpact]) {
      existing.maxImpact = item.impact_level;
    }
  }

  const suggestions: TestSuggestionCandidate[] = [];
  for (const item of merged.values()) {
    if (item.testStatus === "deprecated") {
      suggestions.push({
        test_case_id: item.testCaseId,
        action: "remove",
        reason: `受影响模块 ${item.modules.join("、")} 的关联用例已废弃，建议归档并解除模块引用。`,
        priority: "P3",
      });
      continue;
    }
    suggestions.push({
      test_case_id: item.testCaseId,
      action: "update",
      reason:
        `受影响模块 ${item.modules.join("、")}（最高${IMPACT_LEVEL_META[item.maxImpact].label}）` +
        `→ 建议同步更新用例步骤、断言与回归范围。`,
      priority: worsePriority(item.testPriority, IMPACT_PRIORITY[item.maxImpact]),
    });
  }

  for (const item of input.requirementTests) {
    if (merged.has(item.test_case_id) || item.test_status === "deprecated") continue;
    suggestions.push({
      test_case_id: item.test_case_id,
      action: "add",
      reason: `需求 ${input.requirementKey ?? "—"} 的关联用例尚未覆盖本次受影响模块，建议补充针对性回归场景。`,
      priority: item.test_priority,
    });
  }

  return suggestions.sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.test_case_id - b.test_case_id,
  );
}
