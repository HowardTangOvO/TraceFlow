import { all, get } from "@/lib/db/client";
import type { ChangeCodeImpact, ChangeRequestWithMeta, EffortEstimate, RegressionPlan, Requirement, TestChangeSuggestion } from "@/lib/types";

const CHANGE_SELECT = `SELECT c.*, r.key AS requirement_key, r.title AS requirement_title,
  u.name AS creator_name, a.name AS approver_name,
  (SELECT COUNT(*) FROM change_code_impacts WHERE change_request_id=c.id) AS impact_count,
  (SELECT COUNT(*) FROM effort_estimates WHERE change_request_id=c.id) AS estimate_count,
  (SELECT COUNT(*) FROM test_change_suggestions WHERE change_request_id=c.id) AS suggestion_count
  FROM change_requests c LEFT JOIN requirements r ON r.id=c.requirement_id
  LEFT JOIN users u ON u.id=c.created_by LEFT JOIN users a ON a.id=c.approved_by`;

export function listChanges(q = "", status = ""): ChangeRequestWithMeta[] {
  return all<ChangeRequestWithMeta>(`${CHANGE_SELECT} WHERE (?='' OR c.key LIKE ? OR c.title LIKE ?)
    AND (?='' OR c.status=?) ORDER BY c.id DESC`, q, `%${q}%`, `%${q}%`, status, status);
}

export function changeRequirementOptions() {
  return all<Pick<Requirement, "id" | "key" | "title">>("SELECT id,key,title FROM requirements WHERE status!='deprecated' ORDER BY key");
}

export interface ImpactRow extends ChangeCodeImpact {
  module_key: string;
  module_name: string;
  path: string;
}

export interface SuggestionRow extends TestChangeSuggestion {
  test_key: string;
  test_title: string;
}

export function getChangeDetail(id: number) {
  const change = get<ChangeRequestWithMeta>(`${CHANGE_SELECT} WHERE c.id=?`, id);
  if (!change) return null;
  return {
    change,
    impacts: all<ImpactRow>(`SELECT i.*, m.key AS module_key,m.name AS module_name,m.path
      FROM change_code_impacts i JOIN code_modules m ON m.id=i.code_module_id
      WHERE i.change_request_id=? ORDER BY i.estimated_days DESC`, id),
    estimates: all<EffortEstimate>("SELECT * FROM effort_estimates WHERE change_request_id=? ORDER BY id DESC", id),
    suggestions: all<SuggestionRow>(`SELECT s.*,t.key AS test_key,t.title AS test_title FROM test_change_suggestions s
      JOIN test_cases t ON t.id=s.test_case_id WHERE s.change_request_id=? ORDER BY s.priority,t.key`, id),
    plans: all<RegressionPlan>("SELECT * FROM regression_plans WHERE change_request_id=? ORDER BY id DESC", id),
  };
}
