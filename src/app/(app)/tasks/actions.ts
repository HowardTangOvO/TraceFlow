"use server";

import { getI18n } from "@/lib/i18n/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { assertPermission } from "@/lib/auth";
import { canWriteDimension } from "@/lib/rbac";
import { get, run, tx } from "@/lib/db/client";
import { logAudit } from "@/lib/audit";
import {
  numeric,
  optionalText,
  redirectWithError,
  redirectWithSuccess,
  requiredText,
} from "@/lib/actions";
import { DIMENSION_META, TASK_STATUS_META } from "@/lib/constants";
import { getProject } from "@/lib/queries/common";
import { nowIso } from "@/lib/utils";
import type { Dimension, Requirement, Task, TaskStatus } from "@/lib/types";
import { activeUserId, dateInput, optionalEntityId as optionalId, personDays, safeReturnTo } from "@/components/features/pm/action-utils";

function errorMessage(error: unknown, fallback = "Operation failed. Please try again."): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isTaskStatus(value: string): value is TaskStatus {
  return Object.hasOwn(TASK_STATUS_META, value);
}

function isDimension(value: string): value is Dimension {
  return Object.hasOwn(DIMENSION_META, value);
}

/** 生成下一个任务编号，例如 TASK-019 */
function nextTaskKey(): string {
  const prefix = "TASK";
  const row = get<{ key: string }>(
    `SELECT key FROM tasks WHERE key LIKE ? ORDER BY CAST(substr(key, ${prefix.length + 2}) AS INTEGER) DESC LIMIT 1`,
    `${prefix}-%`,
  );
  const current = row ? Number(row.key.slice(prefix.length + 1)) : 0;
  const next = Number.isFinite(current) ? current + 1 : 1;
  return `${prefix}-${String(next).padStart(3, "0")}`;
}

/** 直接拖拽 / 快速修改任务状态 */
export async function updateTaskStatusAction(formData: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  const taskId = numeric(formData.get("task_id"), 0);
  const statusRaw = optionalText(formData.get("status"), 20);
  const returnTo = safeReturnTo(formData.get("returnTo"), "/tasks");
  let successMessage = "Task status updated.";

  try {
    assertPermission(user, "task.write");

    const task = get<Task>("SELECT * FROM tasks WHERE id = ?", taskId);
    if (!task) throw new Error("Task not found.");
    if (!canWriteDimension(user, task.dimension)) {
      throw new Error(t("You cannot edit tasks in the {dimension} dimension.", { dimension: t(DIMENSION_META[task.dimension].label) }));
    }
    if (!isTaskStatus(statusRaw)) throw new Error("Invalid task status.");
    if (task.status === statusRaw) {
      throw new Error(t("This task is already {status}.", { status: t(TASK_STATUS_META[statusRaw].label) }));
    }

    run("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?", statusRaw, nowIso(), taskId);
    logAudit(
      user,
      "status_changed",
      "task",
      taskId,
      `任务 ${task.key} 状态 ${TASK_STATUS_META[task.status].label} → ${TASK_STATUS_META[statusRaw].label}`,
    );
    successMessage = t("Task {key} moved to {status}.", { key: task.key, status: t(TASK_STATUS_META[statusRaw].label) });
    revalidatePath("/tasks");
    revalidatePath(`/tasks/${taskId}`);
    revalidatePath("/dashboard");
    if (task.requirement_id) revalidatePath(`/requirements/${task.requirement_id}`);
  } catch (error) {
    redirectWithError(returnTo, t(errorMessage(error)));
  }

  redirectWithSuccess(returnTo, t(successMessage));
}

/** 新建任务（维度写权限校验） */
export async function createTaskAction(formData: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  const returnTo = safeReturnTo(formData.get("returnTo"), "/tasks");
  let createdKey = "";
  let createdId = 0;

  try {
    assertPermission(user, "task.write");

    const title = requiredText(formData.get("title"), t("Task title"), 200);
    const dimensionRaw = optionalText(formData.get("dimension"), 10) || "pm";
    if (!isDimension(dimensionRaw)) throw new Error("Invalid task dimension.");
    if (!canWriteDimension(user, dimensionRaw)) {
      throw new Error(t("You cannot create tasks in the {dimension} dimension.", { dimension: t(DIMENSION_META[dimensionRaw].label) }));
    }

    const requirementId = optionalId(formData.get("requirement_id"));
    if (requirementId) {
      const requirement = get<Requirement>("SELECT id FROM requirements WHERE id = ? AND project_id = ?", requirementId, getProject().id);
      if (!requirement) throw new Error("Linked requirement not found.");
    }

    const assigneeId = activeUserId(formData.get("assignee_id"));
    const estimateDays = personDays(formData.get("estimate_days"));
    const dueDate = dateInput(formData.get("due_date"));
    const description = optionalText(formData.get("description_md"), 20000);
    const project = getProject();
    const now = nowIso();

    createdId = tx(() => {
      createdKey = nextTaskKey();
      return run(
        `INSERT INTO tasks
           (project_id, requirement_id, key, title, description_md, status, dimension, assignee_id,
            estimate_days, actual_days, start_date, due_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'todo', ?, ?, ?, 0, NULL, ?, ?, ?)`,
        project.id,
        requirementId,
        createdKey,
        title,
        description,
        dimensionRaw,
        assigneeId,
        estimateDays,
        dueDate,
        now,
        now,
      ).lastInsertRowid;
    });

    logAudit(
      user,
      "created",
      "task",
      createdId,
      `创建任务 ${createdKey}「${title}」· 维度 ${DIMENSION_META[dimensionRaw].label}`,
    );
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    if (requirementId) revalidatePath(`/requirements/${requirementId}`);
  } catch (error) {
    redirectWithError(returnTo, t(errorMessage(error)));
  }

  redirectWithSuccess(returnTo, t("Task {key} created.", { key: createdKey }));
}

/** 编辑任务（详情页表单） */
export async function updateTaskAction(formData: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  const id = numeric(formData.get("id"), 0);
  const returnTo = safeReturnTo(formData.get("returnTo"), id ? `/tasks/${id}` : "/tasks");
  let key = `#${id}`;

  try {
    assertPermission(user, "task.write");

    const current = get<Task>("SELECT * FROM tasks WHERE id = ?", id);
    if (!current) throw new Error("Task not found.");
    if (!canWriteDimension(user, current.dimension)) {
      throw new Error(t("You cannot edit tasks in the {dimension} dimension.", { dimension: t(DIMENSION_META[current.dimension].label) }));
    }
    key = current.key;

    const title = requiredText(formData.get("title"), "Title", 200);
    const dimensionRaw = optionalText(formData.get("dimension"), 10) || current.dimension;
    if (!isDimension(dimensionRaw) || !canWriteDimension(user, dimensionRaw)) {
      throw new Error("You cannot move a task to this dimension.");
    }
    const requirementId = optionalId(formData.get("requirement_id"));
    if (requirementId && !get("SELECT id FROM requirements WHERE id = ? AND project_id = ?", requirementId, current.project_id)) {
      throw new Error("The requirement does not belong to this project.");
    }
    const statusRaw = optionalText(formData.get("status"), 20) || current.status;
    if (!isTaskStatus(statusRaw)) throw new Error("Invalid task status.");
    const assigneeId = activeUserId(formData.get("assignee_id"));
    const estimateDays = personDays(formData.get("estimate_days"));
    const actualDays = personDays(formData.get("actual_days"));
    const dueDate = dateInput(formData.get("due_date"));
    const description = optionalText(formData.get("description_md"), 20000);

    run(
      `UPDATE tasks
       SET title = ?, dimension = ?, requirement_id = ?, status = ?, assignee_id = ?, estimate_days = ?, actual_days = ?, due_date = ?,
           description_md = ?, updated_at = ?
       WHERE id = ?`,
      title,
      dimensionRaw,
      requirementId,
      statusRaw,
      assigneeId,
      estimateDays,
      actualDays,
      dueDate,
      description,
      nowIso(),
      id,
    );

    logAudit(
      user,
      "updated",
      "task",
      id,
      `更新任务 ${key} · 状态 ${TASK_STATUS_META[statusRaw].label} · 预估 ${estimateDays} 人天 · 实际 ${actualDays} 人天`,
    );
    revalidatePath(`/tasks/${id}`);
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    if (current.requirement_id) revalidatePath(`/requirements/${current.requirement_id}`);
    if (requirementId) revalidatePath(`/requirements/${requirementId}`);
  } catch (error) {
    redirectWithError(returnTo, t(errorMessage(error)));
  }

  redirectWithSuccess(returnTo, t("Task {key} updated.", { key: key }));
}

/** 删除任务（仅可删除自己有写权限的维度） */
export async function deleteTaskAction(formData: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  const taskId = numeric(formData.get("task_id"), 0);
  const returnTo = safeReturnTo(formData.get("returnTo"), "/tasks");
  let key = `#${taskId}`;

  try {
    assertPermission(user, "task.write");

    const task = get<Task>("SELECT * FROM tasks WHERE id = ?", taskId);
    if (!task) throw new Error("Task not found.");
    if (!canWriteDimension(user, task.dimension)) {
      throw new Error(t("You cannot edit tasks in the {dimension} dimension.", { dimension: t(DIMENSION_META[task.dimension].label) }));
    }
    key = task.key;

    run("DELETE FROM tasks WHERE id = ?", taskId);
    logAudit(user, "deleted", "task", taskId, `删除任务 ${key}「${task.title}」`);
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    if (task.requirement_id) revalidatePath(`/requirements/${task.requirement_id}`);
  } catch (error) {
    redirectWithError(returnTo, t(errorMessage(error)));
  }

  redirectWithSuccess("/tasks", t("Task {key} deleted.", { key: key }));
}
