"use server";

import { getI18n } from "@/lib/i18n/server";
import { revalidatePath } from "next/cache";
import { requireUser, assertPermission } from "@/lib/auth";
import { get, run, tx } from "@/lib/db/client";
import { getProject } from "@/lib/queries/common";
import { nextPlanKey, listPlanCases } from "@/lib/queries/regression";
import { recommendCasesForChange, recommendationMap } from "@/lib/regression";
import { logAudit } from "@/lib/audit";
import { formIds, optionalId, optionalText, requiredText, redirectWithError, redirectWithSuccess } from "@/lib/actions";
import type { ChangeRequest, RegressionPlan, TestCase } from "@/lib/types";

function idField(formData: FormData, name: string): number {
  const id = optionalId(formData.get(name));
  if (!id) throw new Error("Invalid identifier.");
  return id;
}

function planFor(formData: FormData): RegressionPlan {
  const plan = get<RegressionPlan>("SELECT * FROM regression_plans WHERE id = ?", idField(formData, "plan_id"));
  if (!plan) throw new Error("Regression plan not found.");
  return plan;
}

function refresh(planId: number, caseId?: number) {
  for (const path of ["/regression", `/regression/${planId}`, "/dashboard", "/tests", "/changes"]) revalidatePath(path);
  if (caseId) revalidatePath(`/tests/${caseId}`);
  const plan = get<RegressionPlan>("SELECT * FROM regression_plans WHERE id = ?", planId);
  if (plan?.change_request_id) revalidatePath(`/changes/${plan.change_request_id}`);
}

function destination(formData: FormData): string {
  const id = optionalId(formData.get("plan_id"));
  return id ? `/regression/${id}` : "/regression";
}

/** Recompute recommendation requirements on the server; unchecked mandatory cases cannot be omitted. */
export async function createPlanAction(formData: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  let planId = 0;
  try {
    assertPermission(user, "regression.create");
    const project = getProject();
    const changeId = optionalId(formData.get("change_request_id"));
    if (formData.get("change_request_id") && !changeId) throw new Error("Invalid change request.");
    if (changeId) {
      const change = get<ChangeRequest>("SELECT * FROM change_requests WHERE id = ? AND project_id = ?", changeId, project.id);
      if (!change || change.status === "rejected") throw new Error("The selected change is unavailable.");
    }
    const title = requiredText(formData.get("title"), t("Title"), 200);
    const scope = optionalText(formData.get("scope_desc"));
    const selected = new Set(formIds(formData, "case_ids"));
    if (selected.size !== new Set(formData.getAll("case_ids").map(String)).size) throw new Error("Invalid test case selection.");
    const recommendations = recommendCasesForChange(changeId);
    const byId = new Map(recommendations.map(item => [item.testCase.id, item]));
    for (const item of recommendations) if (item.required) selected.add(item.testCase.id);
    if (!selected.size) throw new Error("Select at least one test case.");
    for (const caseId of selected) {
      if (!get("SELECT id FROM test_cases WHERE id = ? AND project_id = ? AND status = 'active'", caseId, project.id)) throw new Error("Selected test case is unavailable.");
    }
    planId = tx(() => {
      const id = run("INSERT INTO regression_plans (project_id,change_request_id,key,title,status,scope_desc,created_by,created_at) VALUES (?,?,?,?,'planned',?,?,?)", project.id, changeId, nextPlanKey(), title, scope, user.id, new Date().toISOString()).lastInsertRowid;
      for (const caseId of selected) {
        const recommendation = byId.get(caseId);
        run("INSERT INTO regression_plan_cases (plan_id,test_case_id,recommendation_score,reason,required) VALUES (?,?,?,?,?)", id, caseId, recommendation?.score ?? 0, recommendation?.reason ?? "Manually selected", recommendation?.required ? 1 : 0);
      }
      logAudit(user, "generated", "regression_plan", id, `Generated regression plan: ${title}`);
      return id;
    });
    refresh(planId);
  } catch (error) {
    const changeId = optionalId(formData.get("change_request_id"));
    redirectWithError(`/regression/new${changeId ? `?change=${changeId}` : ""}`, error instanceof Error ? t(error.message) : t("Could not create plan."));
  }
  redirectWithSuccess(`/regression/${planId}`, t("Regression plan created."));
}

/** Completion records execution closure; failed cases remain visible and do not imply release approval. */
export async function updatePlanStatusAction(formData: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  const returnTo = destination(formData);
  try {
    assertPermission(user, "regression.execute");
    tx(() => {
      const plan = planFor(formData);
      const action = String(formData.get("status"));
      const now = new Date().toISOString();
      if (action === "start" && plan.status === "planned") {
        if (!listPlanCases(plan.id).length) throw new Error("A plan needs test cases before it can start.");
        run("UPDATE regression_plans SET status='running',started_at=? WHERE id=?", now, plan.id);
      } else if (action === "complete" && plan.status === "running") {
        const cases = listPlanCases(plan.id);
        if (!cases.length) throw new Error("Cannot complete an empty plan.");
        if (cases.some(item => !item.run_result || item.run_result === "not_run")) throw new Error("Record a result for every case before completion.");
        if (cases.some(item => item.required && item.run_result === "skipped")) throw new Error("Required cases cannot be skipped.");
        run("UPDATE regression_plans SET status='completed',completed_at=? WHERE id=?", now, plan.id);
      } else if (action === "abort" && ["planned", "running"].includes(plan.status)) {
        run("UPDATE regression_plans SET status='aborted',completed_at=? WHERE id=?", now, plan.id);
      } else {
        throw new Error("This plan status transition is not allowed.");
      }
      logAudit(user, "status_changed", "regression_plan", plan.id, `Regression plan ${plan.key}: ${action}`);
    });
    refresh(idField(formData, "plan_id"));
  } catch (error) {
    redirectWithError(returnTo, error instanceof Error ? t(error.message) : t("Could not update plan."));
  }
  redirectWithSuccess(returnTo, t("Plan status updated."));
}

export async function recordResultAction(formData: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  const returnTo = destination(formData);
  try {
    assertPermission(user, "regression.execute");
    const caseId = idField(formData, "test_case_id");
    const result = String(formData.get("result"));
    if (!["pass", "fail", "blocked", "skipped"].includes(result)) throw new Error("Invalid test result.");
    const notes = optionalText(formData.get("notes"), 10000);
    const defect = optionalText(formData.get("defect_ref"), 200);
    tx(() => {
      const plan = planFor(formData);
      if (plan.status !== "running") throw new Error("Only running plans accept execution results.");
      const member = get<{ required: number }>("SELECT required FROM regression_plan_cases WHERE plan_id=? AND test_case_id=?", plan.id, caseId);
      if (!member) throw new Error("The test case does not belong to this plan.");
      if (member.required && result === "skipped") throw new Error("Required cases cannot be skipped.");
      const now = new Date().toISOString();
      const runId = run("INSERT INTO test_runs (plan_id,test_case_id,result,executor_id,executed_at,notes,defect_ref) VALUES (?,?,?,?,?,?,?)", plan.id, caseId, result, user.id, now, notes, defect).lastInsertRowid;
      run("UPDATE test_cases SET last_result=?,last_run_at=?,updated_at=? WHERE id=?", result, now, now, caseId);
      logAudit(user, "executed", "test_run", runId, `${plan.key}: test case ${caseId} → ${result}${defect ? ` (${defect})` : ""}`);
    });
    refresh(idField(formData, "plan_id"), caseId);
  } catch (error) {
    redirectWithError(returnTo, error instanceof Error ? t(error.message) : t("Could not record result."));
  }
  redirectWithSuccess(returnTo, t("Execution result recorded."));
}

/** Freeze plan membership after execution starts so the scope cannot shrink to hide failures. */
export async function addPlanCaseAction(formData: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  const returnTo = destination(formData);
  try {
    assertPermission(user, "regression.create");
    tx(() => {
      const plan = planFor(formData);
      if (plan.status !== "planned") throw new Error("Only planned plans can change scope.");
      const caseId = idField(formData, "test_case_id");
      const testCase = get<TestCase>("SELECT * FROM test_cases WHERE id=? AND project_id=? AND status='active'", caseId, plan.project_id);
      if (!testCase) throw new Error("Test case is unavailable.");
      const recommendation = recommendationMap(plan.change_request_id).get(caseId);
      run("INSERT INTO regression_plan_cases (plan_id,test_case_id,recommendation_score,reason,required) VALUES (?,?,?,?,?)", plan.id, caseId, recommendation?.score ?? 0, recommendation?.reason ?? "Manually selected", recommendation?.required || formData.get("required") === "on" ? 1 : 0);
      logAudit(user, "updated", "regression_plan", plan.id, `Added ${testCase.key} to ${plan.key}`);
    });
    refresh(idField(formData, "plan_id"));
  } catch (error) {
    redirectWithError(returnTo, error instanceof Error ? t(error.message) : t("Could not add case."));
  }
  redirectWithSuccess(returnTo, t("Test case added."));
}

export async function removePlanCaseAction(formData: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  const returnTo = destination(formData);
  try {
    assertPermission(user, "regression.create");
    tx(() => {
      const plan = planFor(formData);
      if (plan.status !== "planned") throw new Error("Only planned plans can change scope.");
      const caseId = idField(formData, "test_case_id");
      const member = get<{ required: number }>("SELECT required FROM regression_plan_cases WHERE plan_id=? AND test_case_id=?", plan.id, caseId);
      if (!member) throw new Error("Test case is not in this plan.");
      if (member.required) throw new Error("Required cases cannot be removed.");
      run("DELETE FROM regression_plan_cases WHERE plan_id=? AND test_case_id=?", plan.id, caseId);
      logAudit(user, "updated", "regression_plan", plan.id, `Removed test case ${caseId} from ${plan.key}`);
    });
    refresh(idField(formData, "plan_id"));
  } catch (error) {
    redirectWithError(returnTo, error instanceof Error ? t(error.message) : t("Could not remove case."));
  }
  redirectWithSuccess(returnTo, t("Test case removed."));
}
