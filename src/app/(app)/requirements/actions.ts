"use server";

import { getI18n } from "@/lib/i18n/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { assertPermission } from "@/lib/auth";
import { get, run, tx } from "@/lib/db/client";
import { logAudit } from "@/lib/audit";
import {
  numeric,
  optionalId,
  optionalText,
  redirectWithError,
  redirectWithSuccess,
  requiredText,
} from "@/lib/actions";
import {
  PRIORITY_META,
  REQUIREMENT_STATUS_META,
} from "@/lib/constants";
import { getProject } from "@/lib/queries/common";
import { nowIso } from "@/lib/utils";
import type { CodeModule, Priority, Requirement, RequirementStatus, TestCase } from "@/lib/types";
import { activeUserId, safeReturnTo } from "@/components/features/pm/action-utils";

function errorMessage(error: unknown, fallback = "Operation failed. Please try again."): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isPriority(value: string): value is Priority {
  return Object.hasOwn(PRIORITY_META, value);
}

function isRequirementStatus(value: string): value is RequirementStatus {
  return Object.hasOwn(REQUIREMENT_STATUS_META, value);
}

/** 生成下一个业务编号，例如 REQ-010 */
function nextRequirementKey(): string {
  const prefix = "REQ";
  const row = get<{ key: string }>(
    `SELECT key FROM requirements WHERE key LIKE ? ORDER BY CAST(substr(key, ${prefix.length + 2}) AS INTEGER) DESC LIMIT 1`,
    `${prefix}-%`,
  );
  const current = row ? Number(row.key.slice(prefix.length + 1)) : 0;
  const next = Number.isFinite(current) ? current + 1 : 1;
  return `${prefix}-${String(next).padStart(3, "0")}`;
}

/** 新建需求（PM / admin） */
export async function createRequirementAction(formData: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  const returnTo = safeReturnTo(formData.get("returnTo"), "/requirements");
  let createdKey = "";
  let createdId = 0;

  try {
    assertPermission(user, "requirement.write");

    const title = requiredText(formData.get("title"), t("Requirement title"), 200);
    const priorityRaw = optionalText(formData.get("priority"), 10) || "P2";
    if (!isPriority(priorityRaw)) throw new Error("Invalid priority.");
    const ownerId = activeUserId(formData.get("owner_id"));
    const source = optionalText(formData.get("source"), 120);
    const description = optionalText(formData.get("description_md"), 20000);
    const project = getProject();
    const now = nowIso();

    createdId = tx(() => {
      createdKey = nextRequirementKey();
      return run(
        `INSERT INTO requirements
           (project_id, key, title, description_md, status, priority, owner_id, source, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, 1, ?, ?)`,
        project.id,
        createdKey,
        title,
        description,
        priorityRaw,
        ownerId,
        source,
        now,
        now,
      ).lastInsertRowid;
    });

    logAudit(user, "created", "requirement", createdId, `创建需求 ${createdKey}「${title}」`);
    revalidatePath("/requirements");
    revalidatePath("/dashboard");
  } catch (error) {
    redirectWithError(returnTo, t(errorMessage(error)));
  }

  redirectWithSuccess(returnTo, t("Requirement {key} created as a draft.", { key: createdKey }));
}

/** 编辑需求基本信息 / 状态 / 优先级（版本号 +1） */
export async function updateRequirementAction(formData: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  const id = numeric(formData.get("id"), 0);
  const returnTo = safeReturnTo(formData.get("returnTo"), id ? `/requirements/${id}` : "/requirements");
  let key = `#${id}`;

  try {
    assertPermission(user, "requirement.write");

    const current = get<Requirement>("SELECT * FROM requirements WHERE id = ?", id);
    if (!current) throw new Error("Requirement not found.");
    key = current.key;
    const version = formData.get("version");
    if (version !== null && Number(version) !== current.version) {
      throw new Error("This requirement has changed. Reload before saving.");
    }

    const title = requiredText(formData.get("title"), t("Requirement title"), 200);
    const statusRaw = optionalText(formData.get("status"), 20) || current.status;
    if (!isRequirementStatus(statusRaw)) throw new Error("Invalid requirement status.");
    const priorityRaw = optionalText(formData.get("priority"), 10) || current.priority;
    if (!isPriority(priorityRaw)) throw new Error("Invalid priority.");
    const ownerId = activeUserId(formData.get("owner_id"));
    const source = optionalText(formData.get("source"), 120);
    const description = optionalText(formData.get("description_md"), 20000);

    run(
      `UPDATE requirements
       SET title = ?, description_md = ?, status = ?, priority = ?, owner_id = ?, source = ?,
           version = version + 1, updated_at = ?
       WHERE id = ?`,
      title,
      description,
      statusRaw,
      priorityRaw,
      ownerId,
      source,
      nowIso(),
      id,
    );

    logAudit(
      user,
      "updated",
      "requirement",
      id,
      `更新需求 ${key}「${title}」· 状态 ${REQUIREMENT_STATUS_META[statusRaw].label} · 优先级 ${priorityRaw} · 版本 v${current.version + 1}`,
    );
    revalidatePath(`/requirements/${id}`);
    revalidatePath("/requirements");
    revalidatePath("/dashboard");
  } catch (error) {
    redirectWithError(returnTo, t(errorMessage(error)));
  }

  redirectWithSuccess(returnTo, t("Requirement {key} updated with a new version.", { key: key }));
}

/** 关联代码模块（requirement_code_links） */
export async function linkCodeModuleAction(formData: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  const requirementId = numeric(formData.get("requirement_id"), 0);
  const returnTo = safeReturnTo(
    formData.get("returnTo"),
    requirementId ? `/requirements/${requirementId}` : "/requirements",
  );
  let summaryKey = `#${requirementId}`;

  try {
    assertPermission(user, "requirement.write");
    const requirement = get<Requirement>("SELECT * FROM requirements WHERE id = ?", requirementId);
    if (!requirement) throw new Error("Requirement not found.");
    summaryKey = requirement.key;

    const codeModuleId = optionalId(formData.get("code_module_id"));
    if (!codeModuleId) throw new Error("Select a code module to link.");
    const codeModule = get<CodeModule>("SELECT * FROM code_modules WHERE id = ?", codeModuleId);
    if (!codeModule) throw new Error("Code module not found.");
    if (codeModule.project_id !== requirement.project_id) throw new Error("The module must belong to the same project.");

    const exists = get<{ id: number }>(
      "SELECT id FROM requirement_code_links WHERE requirement_id = ? AND code_module_id = ?",
      requirementId,
      codeModuleId,
    );
    if (exists) throw new Error("This code module is already linked.");

    const note = optionalText(formData.get("note"), 200);
    run(
      "INSERT INTO requirement_code_links (requirement_id, code_module_id, note) VALUES (?, ?, ?)",
      requirementId,
      codeModuleId,
      note,
    );
    logAudit(
      user,
      "updated",
      "requirement",
      requirementId,
      `需求 ${summaryKey} 关联代码模块 ${codeModule.key} ${codeModule.name}`,
    );
    revalidatePath(`/requirements/${requirementId}`);
    revalidatePath("/code");
    revalidatePath("/dashboard");
  } catch (error) {
    redirectWithError(returnTo, t(errorMessage(error)));
  }

  redirectWithSuccess(returnTo, t("Code module linked."));
}

/** 解除代码模块关联 */
export async function unlinkCodeModuleAction(formData: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  const requirementId = numeric(formData.get("requirement_id"), 0);
  const codeModuleId = numeric(formData.get("code_module_id"), 0);
  const returnTo = safeReturnTo(
    formData.get("returnTo"),
    requirementId ? `/requirements/${requirementId}` : "/requirements",
  );
  let summaryKey = `#${requirementId}`;

  try {
    assertPermission(user, "requirement.write");
    const requirement = get<Requirement>("SELECT * FROM requirements WHERE id = ?", requirementId);
    if (!requirement) throw new Error("Requirement not found.");
    summaryKey = requirement.key;

    const codeModule = get<CodeModule>("SELECT * FROM code_modules WHERE id = ?", codeModuleId);
    if (!codeModule) throw new Error("Code module not found.");

    const result = run(
      "DELETE FROM requirement_code_links WHERE requirement_id = ? AND code_module_id = ?",
      requirementId,
      codeModuleId,
    );
    if (result.changes === 0) throw new Error("This link no longer exists.");

    logAudit(
      user,
      "deleted",
      "requirement",
      requirementId,
      `需求 ${summaryKey} 移除代码模块关联 ${codeModule.key} ${codeModule.name}`,
    );
    revalidatePath(`/requirements/${requirementId}`);
    revalidatePath("/code");
    revalidatePath("/dashboard");
  } catch (error) {
    redirectWithError(returnTo, t(errorMessage(error)));
  }

  redirectWithSuccess(returnTo, t("Code module unlinked."));
}

/** 关联测试用例（test_case_requirement_links） */
export async function linkTestCaseAction(formData: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  const requirementId = numeric(formData.get("requirement_id"), 0);
  const returnTo = safeReturnTo(
    formData.get("returnTo"),
    requirementId ? `/requirements/${requirementId}` : "/requirements",
  );
  let summaryKey = `#${requirementId}`;

  try {
    assertPermission(user, "requirement.write");
    const requirement = get<Requirement>("SELECT * FROM requirements WHERE id = ?", requirementId);
    if (!requirement) throw new Error("Requirement not found.");
    summaryKey = requirement.key;

    const testCaseId = optionalId(formData.get("test_case_id"));
    if (!testCaseId) throw new Error("Select a test case to link.");
    const testCase = get<TestCase>("SELECT * FROM test_cases WHERE id = ?", testCaseId);
    if (!testCase) throw new Error("Test case not found.");
    if (testCase.project_id !== requirement.project_id) throw new Error("The test case must belong to the same project.");

    const exists = get<{ id: number }>(
      "SELECT id FROM test_case_requirement_links WHERE test_case_id = ? AND requirement_id = ?",
      testCaseId,
      requirementId,
    );
    if (exists) throw new Error("This test case is already linked.");

    run(
      "INSERT INTO test_case_requirement_links (test_case_id, requirement_id) VALUES (?, ?)",
      testCaseId,
      requirementId,
    );
    logAudit(
      user,
      "updated",
      "requirement",
      requirementId,
      `需求 ${summaryKey} 关联测试用例 ${testCase.key} ${testCase.title}`,
    );
    revalidatePath(`/requirements/${requirementId}`);
    revalidatePath("/tests");
    revalidatePath("/dashboard");
  } catch (error) {
    redirectWithError(returnTo, t(errorMessage(error)));
  }

  redirectWithSuccess(returnTo, t("Test case linked."));
}

/** 解除测试用例关联 */
export async function unlinkTestCaseAction(formData: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  const requirementId = numeric(formData.get("requirement_id"), 0);
  const testCaseId = numeric(formData.get("test_case_id"), 0);
  const returnTo = safeReturnTo(
    formData.get("returnTo"),
    requirementId ? `/requirements/${requirementId}` : "/requirements",
  );
  let summaryKey = `#${requirementId}`;

  try {
    assertPermission(user, "requirement.write");
    const requirement = get<Requirement>("SELECT * FROM requirements WHERE id = ?", requirementId);
    if (!requirement) throw new Error("Requirement not found.");
    summaryKey = requirement.key;

    const testCase = get<TestCase>("SELECT * FROM test_cases WHERE id = ?", testCaseId);
    if (!testCase) throw new Error("Test case not found.");

    const result = run(
      "DELETE FROM test_case_requirement_links WHERE test_case_id = ? AND requirement_id = ?",
      testCaseId,
      requirementId,
    );
    if (result.changes === 0) throw new Error("This link no longer exists.");

    logAudit(
      user,
      "deleted",
      "requirement",
      requirementId,
      `需求 ${summaryKey} 移除测试用例关联 ${testCase.key} ${testCase.title}`,
    );
    revalidatePath(`/requirements/${requirementId}`);
    revalidatePath("/tests");
    revalidatePath("/dashboard");
  } catch (error) {
    redirectWithError(returnTo, t(errorMessage(error)));
  }

  redirectWithSuccess(returnTo, t("Test case unlinked."));
}
