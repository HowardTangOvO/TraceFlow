import { Badge } from "./badge";
import { LocalizedText } from "@/components/i18n/provider";
import { createTranslator, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import {
  CHANGE_STATUS_META,
  CHANGE_TYPE_META,
  CODE_LAYER_META,
  CONFIDENCE_META,
  DIMENSION_META,
  DOC_CATEGORY_META,
  DOC_STATUS_META,
  EFFORT_SOURCE_META,
  IMPACT_ACTION_META,
  IMPACT_LEVEL_META,
  MILESTONE_STATUS_META,
  PLAN_STATUS_META,
  PRIORITY_META,
  REQUIREMENT_STATUS_META,
  RISK_META,
  ROLE_META,
  SUGGESTION_ACTION_META,
  TASK_STATUS_META,
  TEST_CASE_STATUS_META,
  TEST_CASE_TYPE_META,
  TEST_RESULT_META,
  type Meta,
} from "@/lib/constants";

/**
 * 业务状态徽章：按领域自动取标签与颜色
 * <StatusBadge kind="requirement" value={req.status} />
 */
const REGISTRY = {
  requirement: REQUIREMENT_STATUS_META,
  priority: PRIORITY_META,
  task: TASK_STATUS_META,
  dimension: DIMENSION_META,
  role: ROLE_META,
  change: CHANGE_STATUS_META,
  changeType: CHANGE_TYPE_META,
  impact: IMPACT_LEVEL_META,
  impactAction: IMPACT_ACTION_META,
  effortSource: EFFORT_SOURCE_META,
  confidence: CONFIDENCE_META,
  suggestion: SUGGESTION_ACTION_META,
  testResult: TEST_RESULT_META,
  testType: TEST_CASE_TYPE_META,
  testCaseStatus: TEST_CASE_STATUS_META,
  plan: PLAN_STATUS_META,
  milestone: MILESTONE_STATUS_META,
  doc: DOC_CATEGORY_META,
  docStatus: DOC_STATUS_META,
  risk: RISK_META,
  layer: CODE_LAYER_META,
} as const;

export type StatusKind = keyof typeof REGISTRY;

export function StatusBadge({
  kind,
  value,
  className,
  dot = false,
}: {
  kind: StatusKind;
  value: string;
  className?: string;
  dot?: boolean;
}) {
  const map = REGISTRY[kind] as Record<string, Meta<string>>;
  const meta = map?.[value];
  if (!meta) {
    return (
      <Badge tone="gray" className={className}>
        {value}
      </Badge>
    );
  }
  return (
    <Badge tone={meta.tone} className={className} dot={dot} title={meta.description}>
      <LocalizedText>{meta.label}</LocalizedText>
    </Badge>
  );
}

/** 取标签文本（用于表格/导出） */
export function statusLabel(kind: StatusKind, value: string, locale: Locale = DEFAULT_LOCALE): string {
  const map = REGISTRY[kind] as Record<string, Meta<string>>;
  return createTranslator(locale)(map?.[value]?.label ?? value);
}
