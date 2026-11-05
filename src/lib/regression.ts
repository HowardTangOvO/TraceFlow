import { all, get } from "@/lib/db/client";
import { getProject } from "@/lib/queries/common";
import { createTranslator, type Locale, type Translator } from "@/lib/i18n";
import type {
  ChangeRequest,
  ImpactLevel,
  Priority,
  RiskLevel,
  TestCase,
  TestCaseType,
  TestResult,
} from "@/lib/types";

/**
 * 回归用例智能推荐（规则引擎，纯本地计算，无外部依赖）
 *
 * 关联变更的回归计划（recommendCasesForChange(changeId)）：
 *   需求关联 40 + 代码覆盖 30 + 优先级/风险 20 + 历史失败 10 = 100 分
 *   - 需求关联：用例关联了变更所属需求 → 40
 *   - 代码覆盖：用例覆盖变更影响的代码模块 → 高影响 30 / 中影响 22 / 低影响 15（取最高）
 *   - 优先级/风险：P0 14 / P1 12 / P2 8 / P3 4 + 高风险模块 6 / 中风险 4 / 低风险 2（合计 ≤ 20）
 *   - 历史失败：失败 10 / 阻塞 6 / 未执行 4 / 跳过 2
 *   得分 ≥ 80 标记为必测（required）
 *
 * 基线回归（不关联变更）：
 *   优先级 55 + 模块风险 25 + 用例类型 10 + 历史失败 10 = 100 分
 *
 * 每个推荐结果都带可解释的 reason 与得分明细 factors，供 UI 展示「为什么推荐」。
 */

export const REQUIRED_SCORE = 80;
export const CHANGE_MIN_SCORE = 40;
export const BASELINE_MIN_SCORE = 60;

/** 新建回归计划页展示的评分规则说明 */
export const CHANGE_SCORING_RULES: { label: string; points: string; detail: string }[] = [
  { label: "Requirement links", points: "40", detail: "Case links to the changed requirement" },
  { label: "Code coverage", points: "30", detail: "Covers affected modules, prioritizing high impact" },
  { label: "Priority / risk", points: "20", detail: "P0–P3 score 14/12/8/4 plus 6 for high-risk modules" },
  { label: "Execution history", points: "10", detail: "Failed 10 / blocked 6 / not run 4 / skipped 2" },
];

export const BASELINE_SCORING_RULES: { label: string; points: string; detail: string }[] = [
  { label: "Priority", points: "55", detail: "P0–P3 score 55/45/30/10" },
  { label: "Module risk", points: "25", detail: "High-risk modules 25 / medium 15 / low 5" },
  { label: "Case type", points: "10", detail: "Regression 10 / integration 8 / edge 6 / performance 6 / functional 4" },
  { label: "Execution history", points: "10", detail: "Failed 10 / blocked 6 / not run 4 / skipped 2" },
];

export interface RecommendationFactor {
  label: string;
  points: number;
}

export interface RecommendedCase {
  testCase: TestCase;
  score: number;
  required: boolean;
  reason: string;
  factors: RecommendationFactor[];
}

interface TestCaseRequirementLinkRow {
  test_case_id: number;
  requirement_id: number;
}

interface TestCaseCodeLinkRow {
  test_case_id: number;
  code_module_id: number;
}

interface ChangeImpactRow {
  code_module_id: number;
  impact_level: ImpactLevel;
}

interface CodeModuleBrief {
  id: number;
  key: string;
  name: string;
  risk: RiskLevel;
}

const BASELINE_RISK_LABELS: Record<RiskLevel, string> = {
  low: "Covers low-risk modules {modules}",
  medium: "Covers medium-risk modules {modules}",
  high: "Covers high-risk modules {modules}",
};
const MODULE_RISK_LABELS: Record<RiskLevel, string> = {
  low: "Low-risk module", medium: "Medium-risk module", high: "High-risk module",
};
const CHANGE_RISK_LABELS: Record<RiskLevel, string> = {
  low: "Low change risk", medium: "Medium change risk", high: "High change risk",
};
const TYPE_FACTOR_LABELS: Record<TestCaseType, string> = {
  functional: "Functional case", regression: "Regression case", edge: "Edge case",
  integration: "Integration case", performance: "Performance case",
};

/** Translate generated factors independently while preserving stored user-authored evidence. */
export function localizeRecommendationReason(reason: string, locale: Locale): string {
  const t = createTranslator(locale);
  return reason.split(" · ").map(factor => t(factor)).join(" · ");
}

const PRIORITY_ORDER: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
const PRIORITY_POINTS: Record<Priority, number> = { P0: 14, P1: 12, P2: 8, P3: 4 };
const RISK_POINTS: Record<RiskLevel, number> = { high: 6, medium: 4, low: 2 };
const RISK_RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
const IMPACT_POINTS: Record<ImpactLevel, number> = { high: 30, medium: 22, low: 15 };
const HISTORY_POINTS: Record<TestResult, number> = { fail: 10, blocked: 6, not_run: 4, skipped: 2, pass: 0 };

const BASELINE_PRIORITY_POINTS: Record<Priority, number> = { P0: 55, P1: 45, P2: 30, P3: 10 };
const BASELINE_RISK_POINTS: Record<RiskLevel, number> = { high: 25, medium: 15, low: 5 };
const BASELINE_TYPE_POINTS: Record<TestCaseType, number> = {
  regression: 10,
  integration: 8,
  edge: 6,
  performance: 6,
  functional: 4,
};

function pushToMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function historyFactor(result: TestResult, t: Translator): RecommendationFactor | null {
  if (result === "fail") return { label: t("Previous failure: prioritize retesting"), points: HISTORY_POINTS.fail };
  if (result === "blocked") return { label: t("Previously blocked: retest required"), points: HISTORY_POINTS.blocked };
  if (result === "not_run") return { label: t("Not run yet: add coverage"), points: HISTORY_POINTS.not_run };
  if (result === "skipped") return { label: t("Previously skipped: verify coverage"), points: HISTORY_POINTS.skipped };
  return null;
}

function sortRecommended(a: RecommendedCase, b: RecommendedCase): number {
  if (b.score !== a.score) return b.score - a.score;
  const priorityDiff = PRIORITY_ORDER[a.testCase.priority] - PRIORITY_ORDER[b.testCase.priority];
  if (priorityDiff !== 0) return priorityDiff;
  return a.testCase.key.localeCompare(b.testCase.key);
}

/** 加载推荐相关的连接数据，避免 N+1 查询 */
function loadContext(activeCases: TestCase[]) {
  const caseIds = activeCases.map((item) => item.id);
  const requirementLinks = new Map<number, number[]>();
  const codeLinks = new Map<number, number[]>();

  if (caseIds.length > 0) {
    const placeholders = caseIds.map(() => "?").join(", ");
    for (const row of all<TestCaseRequirementLinkRow>(
      `SELECT test_case_id, requirement_id FROM test_case_requirement_links WHERE test_case_id IN (${placeholders})`,
      ...caseIds,
    )) {
      pushToMap(requirementLinks, row.test_case_id, row.requirement_id);
    }
    for (const row of all<TestCaseCodeLinkRow>(
      `SELECT test_case_id, code_module_id FROM test_case_code_links WHERE test_case_id IN (${placeholders})`,
      ...caseIds,
    )) {
      pushToMap(codeLinks, row.test_case_id, row.code_module_id);
    }
  }

  const modules = new Map<number, CodeModuleBrief>();
  for (const row of all<CodeModuleBrief>("SELECT id, key, name, risk FROM code_modules")) {
    modules.set(row.id, row);
  }

  return { requirementLinks, codeLinks, modules };
}

function moduleKeysLabel(ids: number[], modules: Map<number, CodeModuleBrief>): string {
  return ids
    .map((id) => modules.get(id)?.key)
    .filter((key): key is string => Boolean(key))
    .slice(0, 3)
    .join(", ");
}

function maxRiskOf(ids: number[], modules: Map<number, CodeModuleBrief>): RiskLevel | null {
  let level: RiskLevel | null = null;
  for (const id of ids) {
    const risk = modules.get(id)?.risk;
    if (!risk) continue;
    if (!level || RISK_RANK[risk] > RISK_RANK[level]) level = risk;
  }
  return level;
}

/**
 * 为变更推荐回归用例。
 * @param changeId 变更 id；传 null 表示基线回归（不关联变更）
 */
/** Keep the default language stable for persisted evidence; UI callers pass their request locale. */
export function recommendCasesForChange(changeId: number | null, locale: Locale = "en"): RecommendedCase[] {
  const t = createTranslator(locale);
  const change = changeId === null ? undefined : get<ChangeRequest>("SELECT * FROM change_requests WHERE id = ?", changeId);
  if (changeId !== null && !change) return [];
  const projectId = change?.project_id ?? getProject().id;
  const activeCases = all<TestCase>("SELECT * FROM test_cases WHERE status = 'active' AND project_id = ? ORDER BY key", projectId);
  if (activeCases.length === 0) return [];

  const { requirementLinks, codeLinks, modules } = loadContext(activeCases);

  if (changeId === null) {
    // 基线回归：按优先级 + 模块风险 + 类型 + 历史结果打分
    const recommended: RecommendedCase[] = [];
    for (const testCase of activeCases) {
      const factors: RecommendationFactor[] = [];
      let score = 0;

      const priorityPoints = BASELINE_PRIORITY_POINTS[testCase.priority] ?? 0;
      factors.push({ label: t("{priority} priority", { priority: testCase.priority }), points: priorityPoints });
      score += priorityPoints;

      const moduleIds = codeLinks.get(testCase.id) ?? [];
      const risk = maxRiskOf(moduleIds, modules);
      if (risk) {
        const points = BASELINE_RISK_POINTS[risk];
        factors.push({
          label: t(BASELINE_RISK_LABELS[risk], { modules: moduleKeysLabel(moduleIds, modules) }),
          points,
        });
        score += points;
      }

      const typePoints = BASELINE_TYPE_POINTS[testCase.type] ?? 0;
      factors.push({ label: t(TYPE_FACTOR_LABELS[testCase.type]), points: typePoints });
      score += typePoints;

      const history = historyFactor(testCase.last_result, t);
      if (history) {
        factors.push(history);
        score += history.points;
      }

      score = Math.min(100, score);
      if (score >= BASELINE_MIN_SCORE) {
        recommended.push({
          testCase,
          score,
          required: score >= REQUIRED_SCORE,
          reason: factors.map((factor) => factor.label).join(" · "),
          factors,
        });
      }
    }
    return recommended.sort(sortRecommended);
  }

  if (!change) return [];

  // 目标代码模块：优先取变更影响面；变更还没有影响分析时用所属需求的代码关联兜底
  const targetModules = new Map<number, ImpactLevel>();
  for (const impact of all<ChangeImpactRow>(
    "SELECT code_module_id, impact_level FROM change_code_impacts WHERE change_request_id = ?",
    changeId,
  )) {
    targetModules.set(impact.code_module_id, impact.impact_level);
  }
  let targetSource = "impact";
  if (targetModules.size === 0 && change.requirement_id) {
    targetSource = "requirement";
    for (const row of all<{ code_module_id: number }>(
      "SELECT code_module_id FROM requirement_code_links WHERE requirement_id = ?",
      change.requirement_id,
    )) {
      targetModules.set(row.code_module_id, "medium");
    }
  }

  const requirement = change.requirement_id
    ? get<{ key: string; title: string }>("SELECT key, title FROM requirements WHERE id = ?", change.requirement_id)
    : undefined;

  const recommended: RecommendedCase[] = [];
  for (const testCase of activeCases) {
    const factors: RecommendationFactor[] = [];
    let score = 0;

    // 1) 需求关联 40
    const requirementIds = requirementLinks.get(testCase.id) ?? [];
    if (change.requirement_id && requirement && requirementIds.includes(change.requirement_id)) {
      factors.push({ label: t("Linked requirement {key}: {title}", { key: requirement.key, title: requirement.title }), points: 40 });
      score += 40;
    }

    // 2) 代码覆盖 30
    const caseModuleIds = codeLinks.get(testCase.id) ?? [];
    const matchedModules = caseModuleIds.filter((id) => targetModules.has(id));
    if (matchedModules.length > 0) {
      let points = 0;
      for (const id of matchedModules) {
        const impactLevel = targetModules.get(id);
        if (impactLevel) points = Math.max(points, IMPACT_POINTS[impactLevel]);
      }
      points = Math.min(30, points);
      const sourceLabel = targetSource === "impact" ? "Covers changed modules {modules}" : "Covers requirement modules {modules}";
      factors.push({ label: t(sourceLabel, { modules: moduleKeysLabel(matchedModules, modules) }), points });
      score += points;
    }

    // 3) 优先级 / 风险 合计 20
    const priorityPoints = PRIORITY_POINTS[testCase.priority] ?? 0;
    if (priorityPoints > 0) {
      factors.push({ label: t("{priority} priority", { priority: testCase.priority }), points: priorityPoints });
      score += priorityPoints;
    }
    const matchedRisk = maxRiskOf(matchedModules, modules);
    const riskLevel = matchedRisk ?? change.risk_level;
    const riskPoints = Math.min(RISK_POINTS[riskLevel] ?? 0, 20 - priorityPoints);
    if (riskPoints > 0) {
      factors.push({
        label: t(matchedRisk ? MODULE_RISK_LABELS[matchedRisk] : CHANGE_RISK_LABELS[riskLevel]),
        points: riskPoints,
      });
      score += riskPoints;
    }

    // 4) 历史失败 10
    const history = historyFactor(testCase.last_result, t);
    if (history) {
      factors.push(history);
      score += history.points;
    }

    score = Math.min(100, score);
    if (score >= CHANGE_MIN_SCORE) {
      recommended.push({
        testCase,
        score,
        required: score >= REQUIRED_SCORE,
        reason: factors.map((factor) => factor.label).join(" · "),
        factors,
      });
    }
  }

  return recommended.sort(sortRecommended);
}

/** 推荐结果 id -> 推荐信息（新建计划 / 手动添加用例时回填评分） */
export function recommendationMap(changeId: number | null): Map<number, RecommendedCase> {
  const map = new Map<number, RecommendedCase>();
  for (const item of recommendCasesForChange(changeId)) {
    map.set(item.testCase.id, item);
  }
  return map;
}
