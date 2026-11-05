"use server";

import { getI18n } from "@/lib/i18n/server";

import { revalidatePath } from "next/cache";
import { requireUser, assertPermission } from "@/lib/auth";
import { requiredText, optionalText, optionalId, redirectWithError, redirectWithSuccess } from "@/lib/actions";
import { all, get, run, tx } from "@/lib/db/client";
import { getProject } from "@/lib/queries/common";
import { getChangeDetail } from "@/lib/queries/changes";
import { logAudit } from "@/lib/audit";
import { CHANGE_TYPE_META, RISK_META } from "@/lib/constants";
import { analyzeChangeImpact, buildTestChangeSuggestions, type ImpactedModuleTest, type RequirementTestCase } from "@/lib/impact";
import { estimateEffortByRule, estimateEffortByHistory, buildEffortPrompt, parseEffortLlmResult, type EffortResult, type HistorySample } from "@/lib/effort";
import { chatCompletion, tryParseJson } from "@/lib/llm";
import type { ChangeRequest, CodeModule, EffortSource, Requirement, User } from "@/lib/types";

function changeId(form: FormData): number {
  const id = optionalId(form.get("id"));
  if (!id) throw new Error("Invalid change ID.");
  return id;
}

function loadChange(id: number): ChangeRequest {
  const change = get<ChangeRequest>("SELECT * FROM change_requests WHERE id=?", id);
  if (!change) throw new Error("Change not found.");
  return change;
}

function assertEditable(change: ChangeRequest) {
  if (!["draft", "analyzing"].includes(change.status)) throw new Error("Analysis and estimates are locked after submission.");
}

function integer(form: FormData, name: string): number {
  const value = Number(form.get(name) ?? 0);
  if (!Number.isSafeInteger(value) || value < 0 || value > 100_000_000) throw new Error(`Invalid ${name}.`);
  return value;
}

function positiveDays(value: FormDataEntryValue | null): number {
  const days = Number(value);
  if (!Number.isFinite(days) || days < 0.1 || days > 10000) throw new Error("Effort must be between 0.1 and 10,000 person-days.");
  return Math.round(days * 10) / 10;
}

function caseCount(change: ChangeRequest): number {
  return Number(get<{ n: number }>(`SELECT COUNT(DISTINCT t.id) AS n FROM test_cases t
    WHERE t.project_id=? AND t.status!='deprecated' AND (EXISTS (
      SELECT 1 FROM test_case_requirement_links l WHERE l.test_case_id=t.id AND l.requirement_id=?
    ) OR EXISTS (SELECT 1 FROM test_case_code_links l JOIN change_code_impacts i ON i.code_module_id=l.code_module_id
      WHERE l.test_case_id=t.id AND i.change_request_id=?))`, change.project_id, change.requirement_id, change.id)?.n ?? 0);
}

function saveEstimate(change: ChangeRequest, source: EffortSource, result: EffortResult, user: User) {
  run(`INSERT INTO effort_estimates (change_request_id,source,days,breakdown_json,confidence,notes,created_by,created_at)
    VALUES (?,?,?,?,?,?,?,?)`, change.id, source, result.days, JSON.stringify(result.breakdown), result.confidence, result.notes, user.id, new Date().toISOString());
}

function refresh(id: number) {
  revalidatePath("/changes");
  revalidatePath(`/changes/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/requirements");
  revalidatePath("/admin/audit");
  const requirement = get<{ requirement_id: number | null }>("SELECT requirement_id FROM change_requests WHERE id=?", id)?.requirement_id;
  if (requirement) revalidatePath(`/requirements/${requirement}`);
}

function fail(id: number | null, error: unknown, t: (key: string) => string): never {
  redirectWithError(id ? `/changes/${id}` : "/changes", t(error instanceof Error ? error.message : "Change operation failed."));
}

export async function createChangeAction(form: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  let id: number | null = null;
  try {
    assertPermission(user, "change.create");
    const title = requiredText(form.get("title"), "change title", 200);
    const requirementId = optionalId(form.get("requirement_id"));
    const type = String(form.get("change_type") ?? "");
    const risk = String(form.get("risk_level") ?? "");
    if (!Object.hasOwn(CHANGE_TYPE_META, type) || !Object.hasOwn(RISK_META, risk)) throw new Error("Invalid change type or risk.");
    const projectId = getProject().id;
    const files = integer(form, "affected_files");
    const added = integer(form, "added_lines");
    const removed = integer(form, "removed_lines");
    const description = requiredText(form.get("description_md"), "change description", 20000);
    const reason = requiredText(form.get("reason"), "reason", 2000);
    const now = new Date().toISOString();
    id = tx(() => {
      if (!requirementId || !get<Requirement>("SELECT * FROM requirements WHERE id=? AND project_id=? AND status!='deprecated'", requirementId, projectId)) throw new Error("Select an active project requirement.");
      const next = Number(get<{ n: number }>("SELECT COALESCE(MAX(id),0)+1 AS n FROM change_requests")?.n ?? 1);
      const key = `CR-${String(next).padStart(3, "0")}`;
      const created = run(`INSERT INTO change_requests (project_id,requirement_id,key,title,description_md,reason,change_type,risk_level,affected_files,added_lines,removed_lines,created_by,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, projectId, requirementId, key, title, description, reason, type, risk, files, added, removed, user.id, now, now).lastInsertRowid;
      logAudit(user, "created", "change_request", created, `Created ${key}`);
      return created;
    });
  } catch (error) { fail(null, error, t); }
  refresh(id!);
  redirectWithSuccess(`/changes/${id}`, t("Change created. Analyze its impact before submitting for approval."));
}

export async function analyzeChangeAction(form: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  let id: number | null = null;
  try {
    assertPermission(user, "change.analyze");
    id = changeId(form);
    tx(() => {
      const change = loadChange(id!);
      assertEditable(change);
      const requirement = get<Requirement>("SELECT * FROM requirements WHERE id=? AND project_id=?", change.requirement_id, change.project_id);
      if (!requirement) throw new Error("Link a requirement before analysis.");
      const modules = all<CodeModule>(`SELECT m.* FROM code_modules m JOIN requirement_code_links l ON l.code_module_id=m.id
        WHERE l.requirement_id=? AND m.project_id=?`, requirement.id, change.project_id);
      if (!modules.length) throw new Error("Link code modules on the requirement page before analysis.");
      const impacts = analyzeChangeImpact(change, modules, requirement.key);
      run("DELETE FROM change_code_impacts WHERE change_request_id=?", change.id);
      for (const impact of impacts) run(`INSERT INTO change_code_impacts (change_request_id,code_module_id,impact_level,action,reason,estimated_days)
        VALUES (?,?,?,?,?,?)`, change.id, impact.code_module_id, impact.impact_level, impact.action, impact.reason, impact.estimated_days);
      // Reanalysis invalidates earlier recommendations and manual conclusions.
      run("DELETE FROM test_change_suggestions WHERE change_request_id=?", change.id);
      run("DELETE FROM effort_estimates WHERE change_request_id=?", change.id);
      const rule = estimateEffortByRule(change, impacts, { testCaseCount: caseCount(change) });
      saveEstimate(change, "rule", rule, user);
      run("UPDATE change_requests SET status='analyzing',auto_effort_days=?,final_effort_days=NULL,updated_at=? WHERE id=?", rule.days, new Date().toISOString(), change.id);
      logAudit(user, "updated", "change_request", change.id, `Analyzed ${change.key}: ${impacts.length} modules, ${rule.days} person-days`);
    });
  } catch (error) { fail(id, error, t); }
  refresh(id!);
  redirectWithSuccess(`/changes/${id}`, t("Impact analysis and rule estimate saved."));
}

export async function estimateChangeAction(form: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  let id: number | null = null;
  let message = "Effort estimate saved.";
  try {
    assertPermission(user, "effort.write");
    id = changeId(form);
    const detail = getChangeDetail(id);
    if (!detail) throw new Error("Change not found.");
    const { change, impacts } = detail;
    assertEditable(change);
    if (!impacts.length) throw new Error("Run impact analysis first.");
    const count = caseCount(change);
    const source = String(form.get("source")) as EffortSource;
    let result: EffortResult;
    let savedSource = source;
    if (source === "manual") {
      const days = positiveDays(form.get("days"));
      const notes = requiredText(form.get("notes"), "estimate rationale", 2000);
      result = { days, confidence: "high", breakdown: [{ label: "Engineer-confirmed estimate", days }], notes };
    } else if (source === "rule") {
      result = estimateEffortByRule(change, impacts, { testCaseCount: count });
    } else if (source === "history") {
      const historical = estimateEffortByHistory(change, all<HistorySample>("SELECT * FROM change_requests WHERE project_id=? AND status='implemented' AND final_effort_days>0", change.project_id));
      if (!historical) throw new Error("No comparable implemented change has confirmed effort yet.");
      result = historical;
    } else if (source === "llm") {
      const response = await chatCompletion([{ role: "user", content: buildEffortPrompt({ change, impacts, requirementKey: change.requirement_key, testCaseCount: count }) }]);
      const parsed = response.ok ? parseEffortLlmResult(tryParseJson(response.content), response.model) : null;
      result = parsed ?? estimateEffortByRule(change, impacts, { testCaseCount: count });
      if (!parsed) {
        savedSource = "rule";
        message = "AI is unavailable or returned an invalid estimate. A local rule estimate was saved.";
      }
    } else throw new Error("Invalid estimate source.");
    tx(() => {
      const current = loadChange(change.id);
      assertEditable(current);
      // A model request may finish after another user submits or reanalyzes the change.
      if (current.updated_at !== change.updated_at) throw new Error("The change was updated during estimation. Reload and retry.");
      saveEstimate(change, savedSource, result, user);
      run(`UPDATE change_requests SET auto_effort_days=CASE WHEN ?='rule' THEN ? ELSE auto_effort_days END,
        final_effort_days=CASE WHEN ?='manual' THEN ? ELSE final_effort_days END,updated_at=? WHERE id=?`, savedSource, result.days, savedSource, result.days, new Date().toISOString(), change.id);
      logAudit(user, "updated", "change_request", change.id, `Saved ${savedSource} effort: ${result.days} person-days`);
    });
  } catch (error) { fail(id, error, t); }
  refresh(id!);
  redirectWithSuccess(`/changes/${id}`, t(message));
}

export async function generateSuggestionsAction(form: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  let id: number | null = null;
  try {
    assertPermission(user, "change.analyze");
    id = changeId(form);
    tx(() => {
      const change = loadChange(id!);
      if (!["analyzing", "approved"].includes(change.status)) throw new Error("Suggestions can be generated during analysis or after approval.");
      if (!get("SELECT id FROM change_code_impacts WHERE change_request_id=? LIMIT 1", change.id)) throw new Error("Run impact analysis first.");
      const moduleTests = all<ImpactedModuleTest>(`SELECT t.id AS test_case_id,t.key AS test_key,t.title AS test_title,
        t.priority AS test_priority,t.status AS test_status,m.key AS module_key,m.name AS module_name,i.impact_level
        FROM change_code_impacts i JOIN code_modules m ON m.id=i.code_module_id
        JOIN test_case_code_links l ON l.code_module_id=m.id JOIN test_cases t ON t.id=l.test_case_id
        WHERE i.change_request_id=? AND t.project_id=?`, change.id, change.project_id);
      const requirementTests = all<RequirementTestCase>(`SELECT t.id AS test_case_id,t.key AS test_key,t.title AS test_title,
        t.priority AS test_priority,t.status AS test_status FROM test_cases t JOIN test_case_requirement_links l ON l.test_case_id=t.id
        WHERE l.requirement_id=? AND t.project_id=?`, change.requirement_id, change.project_id);
      const key = get<{ key: string }>("SELECT key FROM requirements WHERE id=?", change.requirement_id)?.key ?? null;
      const suggestions = buildTestChangeSuggestions({ moduleTests, requirementTests, requirementKey: key });
      for (const s of suggestions) run(`INSERT INTO test_change_suggestions (change_request_id,test_case_id,action,reason,priority,created_at)
        VALUES (?,?,?,?,?,?) ON CONFLICT(change_request_id,test_case_id) DO UPDATE SET
        resolved=CASE WHEN action=excluded.action AND reason=excluded.reason THEN resolved ELSE 0 END,
        action=excluded.action,reason=excluded.reason,priority=excluded.priority`, change.id, s.test_case_id, s.action, s.reason, s.priority, new Date().toISOString());
      run("UPDATE change_requests SET updated_at=? WHERE id=?", new Date().toISOString(), change.id);
      logAudit(user, "generated", "change_request", change.id, `Generated ${suggestions.length} test change suggestions`);
    });
  } catch (error) { fail(id, error, t); }
  refresh(id!);
  redirectWithSuccess(`/changes/${id}`, t("Test change suggestions generated. Testers review and resolve them."));
}

export async function resolveSuggestionAction(form: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  let id: number | null = null;
  try {
    assertPermission(user, "testcase.write");
    id = changeId(form);
    const suggestionId = optionalId(form.get("suggestion_id"));
    const resolved = String(form.get("resolved"));
    if (!suggestionId || !["0", "1"].includes(resolved)) throw new Error("Invalid suggestion update.");
    tx(() => {
      const change = loadChange(id!);
      if (!["analyzing", "pending_approval", "approved"].includes(change.status)) throw new Error("Suggestions are locked for this change.");
      const result = run("UPDATE test_change_suggestions SET resolved=? WHERE id=? AND change_request_id=?", Number(resolved), suggestionId, change.id);
      if (!result.changes) throw new Error("Suggestion not found for this change.");
      logAudit(user, "updated", "change_request", change.id, `${resolved === "1" ? "Resolved" : "Reopened"} test suggestion ${suggestionId}`);
    });
  } catch (error) { fail(id, error, t); }
  refresh(id!);
  redirectWithSuccess(`/changes/${id}`, t("Suggestion status saved."));
}

export async function transitionChangeAction(form: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  let id: number | null = null;
  try {
    id = changeId(form);
    const target = String(form.get("status"));
    tx(() => {
      const change = loadChange(id!);
      const now = new Date().toISOString();
      if (target === "pending_approval") {
        assertPermission(user, "change.analyze");
        if (change.status !== "analyzing") throw new Error("Only an analyzed change can be submitted.");
        if (!get("SELECT id FROM change_code_impacts WHERE change_request_id=? LIMIT 1", change.id) || !get("SELECT id FROM effort_estimates WHERE change_request_id=? LIMIT 1", change.id)) throw new Error("Impact analysis and effort estimate are required.");
        run("UPDATE change_requests SET status=?,updated_at=? WHERE id=?", target, now, change.id);
      } else if (target === "approved" || target === "rejected") {
        assertPermission(user, "change.approve");
        if (change.status !== "pending_approval") throw new Error("Only a pending change can be approved or rejected.");
        const days = target === "approved" ? positiveDays(form.get("final_effort_days")) : null;
        run("UPDATE change_requests SET status=?,final_effort_days=?,approved_by=?,approved_at=?,updated_at=? WHERE id=?", target, days, user.id, now, now, change.id);
        if (target === "approved" && change.requirement_id) run("UPDATE requirements SET status='changed',version=version+1,updated_at=? WHERE id=? AND status!='deprecated'", now, change.requirement_id);
      } else if (target === "implemented") {
        assertPermission(user, "change.analyze");
        if (change.status !== "approved") throw new Error("Only an approved change can be marked implemented.");
        if (caseCount(change) > 0 && !get("SELECT id FROM test_change_suggestions WHERE change_request_id=? LIMIT 1", change.id)) throw new Error("Generate and review test change suggestions before implementation.");
        if (get("SELECT id FROM test_change_suggestions WHERE change_request_id=? AND resolved=0 LIMIT 1", change.id)) throw new Error("Resolve all test change suggestions first.");
        // A newer incomplete or failing regression must supersede an older successful plan.
        const safePlan = get<{ id: number }>(`SELECT p.id FROM regression_plans p WHERE p.change_request_id=? AND p.status='completed'
          AND p.id=(SELECT MAX(latest.id) FROM regression_plans latest WHERE latest.change_request_id=p.change_request_id AND latest.status!='aborted')
          AND EXISTS (SELECT 1 FROM regression_plan_cases pc WHERE pc.plan_id=p.id)
          AND NOT EXISTS (SELECT 1 FROM regression_plan_cases pc WHERE pc.plan_id=p.id AND pc.required=1
            AND COALESCE((SELECT tr.result FROM test_runs tr WHERE tr.plan_id=p.id AND tr.test_case_id=pc.test_case_id ORDER BY tr.id DESC LIMIT 1),'not_run')!='pass')
          AND NOT EXISTS (SELECT 1 FROM regression_plan_cases pc WHERE pc.plan_id=p.id
            AND COALESCE((SELECT tr.result FROM test_runs tr WHERE tr.plan_id=p.id AND tr.test_case_id=pc.test_case_id ORDER BY tr.id DESC LIMIT 1),'not_run') IN ('fail','blocked','not_run'))
          ORDER BY p.id DESC LIMIT 1`, change.id);
        if (!safePlan) throw new Error("The latest regression must be completed with all required cases passing and no failed, blocked or unexecuted cases.");
        run("UPDATE change_requests SET status='implemented',updated_at=? WHERE id=?", now, change.id);
        if (change.requirement_id && !get("SELECT id FROM change_requests WHERE requirement_id=? AND id!=? AND status IN ('approved','pending_approval','analyzing') LIMIT 1", change.requirement_id, change.id)) run("UPDATE requirements SET status='active',updated_at=? WHERE id=? AND status='changed'", now, change.requirement_id);
      } else throw new Error("Invalid change transition.");
      logAudit(user, target === "approved" ? "approved" : target === "rejected" ? "rejected" : "status_changed", "change_request", change.id, `${change.key}: ${change.status} → ${target}`);
    });
  } catch (error) { fail(id, error, t); }
  refresh(id!);
  redirectWithSuccess(`/changes/${id}`, t("Change status updated."));
}
