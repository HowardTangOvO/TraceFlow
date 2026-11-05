import { all, get, type SqlValue } from "@/lib/db/client";
import type { Dimension, Requirement, Task, TaskStatus, TaskWithMeta } from "@/lib/types";

export interface TaskFilters {
  dimension?: Dimension;
  status?: TaskStatus;
  assignee?: number;
  q?: string;
}

const LIST_SELECT = `
  SELECT t.*, r.key AS requirement_key, r.title AS requirement_title,
         u.name AS assignee_name, u.avatar_color AS assignee_color
  FROM tasks t
  LEFT JOIN requirements r ON r.id = t.requirement_id
  LEFT JOIN users u ON u.id = t.assignee_id`;

/** 任务列表 / 看板数据（支持维度 / 状态 / 负责人 / 关键词筛选） */
export function listTasks(filters: TaskFilters = {}): TaskWithMeta[] {
  const where: string[] = [];
  const params: SqlValue[] = [];

  if (filters.dimension) {
    where.push("t.dimension = ?");
    params.push(filters.dimension);
  }
  if (filters.status) {
    where.push("t.status = ?");
    params.push(filters.status);
  }
  if (filters.assignee) {
    where.push("t.assignee_id = ?");
    params.push(filters.assignee);
  }
  if (filters.q) {
    const like = `%${filters.q}%`;
    where.push("(t.key LIKE ? OR t.title LIKE ? OR t.description_md LIKE ? OR r.key LIKE ? OR r.title LIKE ?)");
    params.push(like, like, like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return all<TaskWithMeta>(
    `${LIST_SELECT} ${whereSql} ORDER BY (t.due_date IS NULL), t.due_date ASC, t.key ASC`,
    ...params,
  );
}

export interface TaskStats {
  total: number;
  done: number;
  inProgress: number;
  review: number;
  blocked: number;
  todo: number;
  backlog: number;
  overdue: number;
  estimateDays: number;
  actualDays: number;
}

/** 全量任务统计（看板顶部指标） */
export function getTaskStats(): TaskStats {
  const row = get<{
    total: number;
    done: number;
    in_progress: number;
    review: number;
    blocked: number;
    todo: number;
    backlog: number;
    overdue: number;
    estimate: number;
    actual: number;
  }>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS done,
            COALESCE(SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END), 0) AS in_progress,
            COALESCE(SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END), 0) AS review,
            COALESCE(SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END), 0) AS blocked,
            COALESCE(SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END), 0) AS todo,
            COALESCE(SUM(CASE WHEN status = 'backlog' THEN 1 ELSE 0 END), 0) AS backlog,
            COALESCE(SUM(CASE WHEN status NOT IN ('done','blocked') AND due_date IS NOT NULL AND due_date < date('now') THEN 1 ELSE 0 END), 0) AS overdue,
            COALESCE(SUM(estimate_days), 0) AS estimate,
            COALESCE(SUM(actual_days), 0) AS actual
     FROM tasks`,
  );
  const num = (value: unknown) => Number(value ?? 0);
  return {
    total: num(row?.total),
    done: num(row?.done),
    inProgress: num(row?.in_progress),
    review: num(row?.review),
    blocked: num(row?.blocked),
    todo: num(row?.todo),
    backlog: num(row?.backlog),
    overdue: num(row?.overdue),
    estimateDays: num(row?.estimate),
    actualDays: num(row?.actual),
  };
}

export interface TaskDetail {
  task: TaskWithMeta;
  requirement: Requirement | null;
  siblingTasks: TaskWithMeta[];
}

/** 任务详情 + 关联需求与同需求其他任务 */
export function getTaskDetail(id: number): TaskDetail | null {
  const task = get<TaskWithMeta>(`${LIST_SELECT} WHERE t.id = ?`, id);
  if (!task) return null;

  const requirement = task.requirement_id
    ? get<Requirement>("SELECT * FROM requirements WHERE id = ?", task.requirement_id) ?? null
    : null;

  const siblingTasks = task.requirement_id
    ? all<TaskWithMeta>(
        `${LIST_SELECT} WHERE t.requirement_id = ? AND t.id != ? ORDER BY t.key LIMIT 6`,
        task.requirement_id,
        id,
      )
    : [];

  return { task, requirement, siblingTasks };
}

/** 任务状态原始行（Server Action 中做权限与存在性校验用） */
export function getTaskRow(id: number): Task | undefined {
  return get<Task>("SELECT * FROM tasks WHERE id = ?", id);
}
