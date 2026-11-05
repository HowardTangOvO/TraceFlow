"use server";

import { getI18n } from "@/lib/i18n/server";
import { revalidatePath } from "next/cache";
import { requireUser, assertPermission } from "@/lib/auth";
import { all, get, run, tx } from "@/lib/db/client";
import { getProject } from "@/lib/queries/common";
import { nextTestCaseKey } from "@/lib/queries/tests";
import { logAudit } from "@/lib/audit";
import { formIds, optionalId, optionalText, redirectWithError, redirectWithSuccess, requiredText } from "@/lib/actions";
import type { TestCase } from "@/lib/types";

function checkedEnum(value: FormDataEntryValue | null, choices: readonly string[], label: string): string {
  const text = String(value ?? "");
  if (!choices.includes(text)) throw new Error("Invalid test case field.");
  return text;
}

/** Keep trace links and the case update atomic so failed validation cannot erase coverage. */
export async function saveTestCaseAction(formData: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  const rawId = formData.get("id");
  const id = optionalId(rawId);
  const returnTo = id ? `/tests/${id}` : "/tests";
  let savedId = id;
  try {
    assertPermission(user, "testcase.write");
    if (rawId && !id) throw new Error("Invalid test case ID.");
    const existing = id ? get<TestCase>("SELECT * FROM test_cases WHERE id = ?", id) : null;
    if (id && !existing) throw new Error("Test case not found.");
    const projectId = existing?.project_id ?? getProject().id;
    const title = requiredText(formData.get("title"), t("Title"), 200);
    const type = checkedEnum(formData.get("type"), ["functional", "regression", "edge", "integration", "performance"], "test type");
    const priority = checkedEnum(formData.get("priority"), ["P0", "P1", "P2", "P3"], "priority");
    const status = checkedEnum(formData.get("status"), ["active", "draft", "deprecated"], "status");
    const owner = optionalId(formData.get("owner_id"));
    if (formData.get("owner_id") && !owner) throw new Error("Invalid owner.");
    if (owner && !get("SELECT id FROM users WHERE id = ? AND active = 1", owner)) throw new Error("Owner is unavailable.");
    const automated = ["on", "1", "true"].includes(String(formData.get("automated"))) ? 1 : 0;
    const precondition = optionalText(formData.get("precondition_md"));
    const steps = requiredText(formData.get("steps_md"), t("Test steps"), 20000);
    const expected = requiredText(formData.get("expected_md"), t("Expected results"), 20000);
    const requirements = [...new Set(formIds(formData, "requirement_ids"))];
    const modules = [...new Set(formIds(formData, "code_module_ids"))];
    if (requirements.length !== new Set(formData.getAll("requirement_ids").map(String)).size || modules.length !== new Set(formData.getAll("code_module_ids").map(String)).size) throw new Error("Invalid trace link.");
    for (const reqId of requirements) {
      if (!get("SELECT id FROM requirements WHERE id = ? AND project_id = ?", reqId, projectId)) throw new Error("Requirement not found in this project.");
    }
    for (const moduleId of modules) {
      if (!get("SELECT id FROM code_modules WHERE id = ? AND project_id = ?", moduleId, projectId)) throw new Error("Code module not found in this project.");
    }
    const now = new Date().toISOString();
    savedId = tx(() => {
      let caseId = id;
      if (caseId) {
        run("UPDATE test_cases SET title=?,type=?,priority=?,status=?,owner_id=?,automated=?,precondition_md=?,steps_md=?,expected_md=?,updated_at=? WHERE id=?", title, type, priority, status, owner, automated, precondition, steps, expected, now, caseId);
      } else {
        caseId = run("INSERT INTO test_cases (project_id,key,title,type,priority,status,owner_id,automated,precondition_md,steps_md,expected_md,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", projectId, nextTestCaseKey(), title, type, priority, status, owner, automated, precondition, steps, expected, now, now).lastInsertRowid;
      }
      run("DELETE FROM test_case_requirement_links WHERE test_case_id = ?", caseId);
      run("DELETE FROM test_case_code_links WHERE test_case_id = ?", caseId);
      for (const reqId of requirements) run("INSERT INTO test_case_requirement_links (test_case_id,requirement_id) VALUES (?,?)", caseId, reqId);
      for (const moduleId of modules) run("INSERT INTO test_case_code_links (test_case_id,code_module_id) VALUES (?,?)", caseId, moduleId);
      logAudit(user, id ? "updated" : "created", "test_case", caseId, `${id ? "Updated" : "Created"} test case: ${title}`);
      return caseId;
    });
    for (const path of ["/tests", `/tests/${savedId}`, "/requirements", "/code", "/dashboard", "/regression/new"]) revalidatePath(path);
    const linkedPlans = all<{ id: number }>("SELECT plan_id AS id FROM regression_plan_cases WHERE test_case_id = ?", savedId);
    for (const plan of linkedPlans) revalidatePath(`/regression/${plan.id}`);
  } catch (error) {
    redirectWithError(returnTo, error instanceof Error ? t(error.message) : t("Could not save the test case."));
  }
  redirectWithSuccess(`/tests/${savedId}`, t("Test case saved."));
}
