/**
 * Effort（工作量）评估引擎（纯函数，不直接读写数据库）
 *
 * 支持四种来源：
 * - rule     规则引擎：代码改动量 + 影响模块风险等级 + 用例覆盖
 * - history  历史校准：同需求 / 同类型已上线变更的实际 final_effort_days 均值
 * - llm      AI 辅助：由调用方通过 @/lib/llm 的 chatCompletion 获取 JSON 后规范化
 * - manual   人工校准（表单提交，由 action 直接写库）
 *
 * 所有结果都输出 breakdown（拆分明细），页面用条形图展示。
 */
import { CHANGE_TYPE_META, IMPACT_LEVEL_META, RISK_META } from "@/lib/constants";
import type {
  ChangeRequest,
  ChangeType,
  Confidence,
  EffortBreakdownItem,
  ImpactLevel,
} from "@/lib/types";
import { clamp } from "@/lib/utils";

export interface EffortImpact {
  impact_level: ImpactLevel;
  estimated_days: number;
  module_key?: string;
  module_name?: string;
}

export interface EffortResult {
  days: number;
  confidence: Confidence;
  breakdown: EffortBreakdownItem[];
  notes: string;
}

const CONFIDENCE_VALUES: Confidence[] = ["low", "medium", "high"];

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/* -------------------------------------------------------------------------- */
/* 规则引擎                                                                     */
/* -------------------------------------------------------------------------- */

export interface RuleEffortOptions {
  /** 受影响模块关联的去重用例数（用于测算测试与联调预留） */
  testCaseCount?: number;
}

/**
 * 规则引擎估算：
 * 1) 代码改动：按 (新增 + 删除) 行数 × 0.0045 人天/行，封顶 12 人天
 * 2) 模块修正：高影响模块 × 0.6 + 中影响 × 0.3 + 低影响 × 0.15，封顶 6 人天
 * 3) 测试预留：关联用例数 × 0.12，封顶 2.5 人天
 */
export function estimateEffortByRule(
  change: ChangeRequest,
  impacts: EffortImpact[],
  options: RuleEffortOptions = {},
): EffortResult {
  const lines = Math.max(0, change.added_lines) + Math.max(0, change.removed_lines);
  const testCaseCount = Math.max(0, options.testCaseCount ?? 0);

  const codeDays = round1(clamp(lines * 0.0045, lines > 0 ? 0.3 : 0, 12));
  const highCount = impacts.filter((item) => item.impact_level === "high").length;
  const mediumCount = impacts.filter((item) => item.impact_level === "medium").length;
  const lowCount = impacts.filter((item) => item.impact_level === "low").length;
  const couplingDays = round1(clamp(highCount * 0.6 + mediumCount * 0.3 + lowCount * 0.15, 0, 6));
  const testDays = round1(clamp(testCaseCount * 0.12, impacts.length > 0 || testCaseCount > 0 ? 0.3 : 0, 2.5));

  let breakdown: EffortBreakdownItem[] = [
    {
      label: `代码改动（${change.added_lines}+/${change.removed_lines}-，${change.affected_files} 个文件）`,
      days: codeDays,
      note: lines > 0 ? "按 0.0045 人天/行加权" : "暂无代码行数据",
    },
    {
      label: "受影响模块修正",
      days: couplingDays,
      note: `${highCount} 个高影响 · ${mediumCount} 个中影响 · ${lowCount} 个低影响`,
    },
    {
      label: "测试与联调预留",
      days: testDays,
      note: `覆盖 ${testCaseCount} 个关联用例`,
    },
  ].filter((item) => item.days > 0);

  let days = round1(breakdown.reduce((sum, item) => sum + item.days, 0));
  if (days <= 0) {
    breakdown = [{ label: "基础评估（无代码改动与影响数据）", days: 0.5, note: "按最小改动预留" }];
    days = 0.5;
  }

  const confidence: Confidence =
    impacts.length === 0
      ? "low"
      : impacts.length >= 4 && change.risk_level !== "high" && testCaseCount >= 4
        ? "high"
        : "medium";

  return {
    days,
    confidence,
    breakdown,
    notes:
      `规则引擎：按代码改动量、影响模块风险与用例覆盖自动计算` +
      `（${risksLabel(impacts)}；${IMPACT_LEVEL_META[change.risk_level].label.replace("影响", "")}变更）。`,
  };
}

function risksLabel(impacts: EffortImpact[]): string {
  if (!impacts.length) return "尚未完成影响分析";
  const high = impacts.filter((item) => item.impact_level === "high").length;
  return `${impacts.length} 个受影响模块${high > 0 ? `，其中 ${high} 个高影响` : ""}`;
}

/* -------------------------------------------------------------------------- */
/* 历史校准                                                                     */
/* -------------------------------------------------------------------------- */

export interface HistorySample {
  id: number;
  key: string;
  title: string;
  change_type: ChangeType;
  requirement_id: number | null;
  affected_files: number;
  final_effort_days: number | null;
}

/**
 * 历史校准：优先取「同需求」已上线变更，其次取「同类型」已上线变更的 final_effort_days 均值，
 * 再按本次文件数相对历史均值做范围系数修正。
 */
export function estimateEffortByHistory(
  change: ChangeRequest,
  samples: HistorySample[],
): EffortResult | null {
  const usable = samples.filter(
    (sample) => sample.id !== change.id && typeof sample.final_effort_days === "number" && sample.final_effort_days > 0,
  );
  const sameRequirement = usable.filter(
    (sample) => change.requirement_id !== null && sample.requirement_id === change.requirement_id,
  );
  const sameType = usable.filter((sample) => sample.change_type === change.change_type);
  const pool = sameRequirement.length > 0 ? sameRequirement : sameType;
  if (!pool.length) return null;

  const meanDays = pool.reduce((sum, sample) => sum + (sample.final_effort_days ?? 0), 0) / pool.length;
  const avgFiles = pool.reduce((sum, sample) => sum + Math.max(0, sample.affected_files), 0) / pool.length;
  const fileRatio = avgFiles > 0 && change.affected_files > 0 ? change.affected_files / avgFiles : 1;
  const scopeDays = round1(clamp((fileRatio - 1) * meanDays * 0.3, -Math.min(2, meanDays * 0.3), 2));
  const days = round1(Math.max(0.5, meanDays + scopeDays));

  const breakdown: EffortBreakdownItem[] = [
    {
      label: `历史同类变更均值（${pool.length} 个已上线变更）`,
      days: round1(meanDays),
      note: pool
        .map((sample) => `${sample.key} ${round1(sample.final_effort_days ?? 0)} 人天`)
        .join("、"),
    },
  ];
  const adjusted = round1(days - round1(meanDays));
  if (adjusted !== 0) {
    breakdown.push({
      label: "范围系数（文件数对比历史均值）",
      days: adjusted,
      note: `本次 ${change.affected_files} 个文件 / 历史均值 ${round1(avgFiles)} 个文件`,
    });
  }

  return {
    days,
    confidence: pool.length >= 3 ? "high" : "medium",
    breakdown,
    notes: `${sameRequirement.length > 0 ? "同需求" : "同类型"}已上线变更校准：${pool
      .map((sample) => sample.key)
      .join("、")}。`,
  };
}

/* -------------------------------------------------------------------------- */
/* AI 辅助                                                                      */
/* -------------------------------------------------------------------------- */

export interface EffortPromptInput {
  change: ChangeRequest;
  impacts: EffortImpact[];
  requirementKey: string | null;
  testCaseCount: number;
}

/** 构造给 LLM 的评估提示词（要求严格 JSON 输出，便于 tryParseJson 解析） */
export function buildEffortPrompt(input: EffortPromptInput): string {
  const { change, impacts, requirementKey, testCaseCount } = input;
  const impactLines = impacts.length
    ? impacts
        .map(
          (item) =>
            `- ${item.module_key ?? "模块"} ${item.module_name ?? ""}｜${IMPACT_LEVEL_META[item.impact_level].label}｜当前预估 ${item.estimated_days} 人天`,
        )
        .join("\n")
    : "- （尚未完成影响分析）";

  return [
    "你是资深研发经理，请为一次研发变更做工作量（人天）评估。",
    "",
    `变更编号：${change.key}`,
    `变更标题：${change.title}`,
    `变更类型：${CHANGE_TYPE_META[change.change_type].label}`,
    `变更风险：${RISK_META[change.risk_level].label}`,
    `关联需求：${requirementKey ?? "未关联"}`,
    `代码改动：新增 ${change.added_lines} 行 / 删除 ${change.removed_lines} 行 / ${change.affected_files} 个文件`,
    `关联测试用例：${testCaseCount} 个`,
    "",
    "变更说明：",
    (change.description_md || "（无）").slice(0, 1800),
    "",
    "变更原因：",
    (change.reason || "（无）").slice(0, 600),
    "",
    "受影响模块（规则引擎初判）：",
    impactLines,
    "",
    "请只输出严格 JSON（不要 Markdown 代码块、不要解释文字），字段如下：",
    '{"days": 3.5, "confidence": "low|medium|high", "breakdown": [{"label": "拆分项名称", "days": 1.5, "note": "依据"}], "notes": "一句话评估依据"}',
    "要求：days 为 1 位小数的人天，且约等于 breakdown 各项之和；breakdown 控制在 3-6 项。",
  ].join("\n");
}

interface LlmEffortPayload {
  days?: unknown;
  confidence?: unknown;
  breakdown?: unknown;
  notes?: unknown;
}

/** 校验并规范化模型返回的 JSON；不合法返回 null，由调用方降级为规则估算 */
export function parseEffortLlmResult(payload: unknown, model: string): EffortResult | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as LlmEffortPayload;
  if (Array.isArray(data)) return null;

  const daysRaw = Number(data.days);
  if (!Number.isFinite(daysRaw) || daysRaw < 0.1 || daysRaw > 60) return null;
  const days = round1(daysRaw);

  const confidenceRaw = String(data.confidence ?? "").toLowerCase();
  const confidence: Confidence = CONFIDENCE_VALUES.includes(confidenceRaw as Confidence)
    ? (confidenceRaw as Confidence)
    : "low";

  const breakdown: EffortBreakdownItem[] = [];
  if (Array.isArray(data.breakdown)) {
    for (const entry of data.breakdown.slice(0, 8)) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      const label = String(row.label ?? "").trim();
      const itemDays = Number(row.days);
      if (!label || !Number.isFinite(itemDays) || itemDays < 0 || itemDays > 60) return null;
      const item: EffortBreakdownItem = { label: label.slice(0, 80), days: round1(itemDays) };
      const note = String(row.note ?? "").trim();
      if (note) item.note = note.slice(0, 120);
      breakdown.push(item);
    }
  }
  if (!breakdown.length) breakdown.push({ label: "AI 综合评估", days });
  // Inconsistent totals are rejected so the caller can keep an auditable rule estimate.
  const total = round1(breakdown.reduce((sum, item) => sum + item.days, 0));
  if (Math.abs(total - days) > 0.1) return null;

  const notesRaw = typeof data.notes === "string" ? data.notes.trim() : "";
  return {
    days,
    confidence,
    breakdown,
    notes: notesRaw ? notesRaw.slice(0, 300) : `AI 辅助评估（模型 ${model}）`,
  };
}

export { CONFIDENCE_VALUES };
