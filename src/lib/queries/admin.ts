import { all, get } from "@/lib/db/client";
import type { AuditLog, PublicUser, Role } from "@/lib/types";

const PUBLIC_USER_COLUMNS =
  "id, email, name, role, title, avatar_color, active, created_at, last_login_at";

/** 系统管理用：包含已禁用账号 */
export function listManagedUsers(): PublicUser[] {
  return all<PublicUser>(
    `SELECT ${PUBLIC_USER_COLUMNS} FROM users
     ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'pm' THEN 1 WHEN 'tech' THEN 2 ELSE 3 END, id`,
  );
}

export function getManagedUser(id: number): PublicUser | undefined {
  return get<PublicUser>(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ?`, id);
}

export function countActiveAdmins(excludeId?: number): number {
  const row = excludeId
    ? get<{ c: number }>(
        "SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1 AND id != ?",
        excludeId,
      )
    : get<{ c: number }>("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1");
  return Number(row?.c ?? 0);
}

export interface AdminUserStats {
  total: number;
  active: number;
  inactive: number;
  byRole: { role: Role; count: number }[];
}

export function getAdminUserStats(): AdminUserStats {
  const total = Number(get<{ c: number }>("SELECT COUNT(*) AS c FROM users")?.c ?? 0);
  const active = Number(get<{ c: number }>("SELECT COUNT(*) AS c FROM users WHERE active = 1")?.c ?? 0);
  const byRole = all<{ role: Role; c: number }>(
    "SELECT role, COUNT(*) AS c FROM users GROUP BY role",
  ).map((row) => ({ role: row.role, count: Number(row.c) }));
  return { total, active, inactive: total - active, byRole };
}

/* ------------------------------- 审计日志 ------------------------------- */

export interface AuditLogWithUser extends AuditLog {
  user_name: string | null;
  user_role: Role | null;
  avatar_color: string | null;
}

export interface AuditLogFilter {
  action?: string;
  entity?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogPage {
  rows: AuditLogWithUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 转义 LIKE 通配符（与 SQL 中的 ESCAPE '\' 配合） */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function listAuditLogs(filter: AuditLogFilter = {}): AuditLogPage {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filter.action) {
    conditions.push("a.action = ?");
    params.push(filter.action);
  }
  if (filter.entity) {
    conditions.push("a.entity_type = ?");
    params.push(filter.entity);
  }
  const q = filter.q?.trim();
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    conditions.push(
      "(a.summary LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\' OR a.action LIKE ? ESCAPE '\\' OR a.entity_type LIKE ? ESCAPE '\\')",
    );
    params.push(pattern, pattern, pattern, pattern);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const from = `FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ${where}`;

  const total = Number(get<{ c: number }>(`SELECT COUNT(*) AS c ${from}`, ...params)?.c ?? 0);
  const pageSize = Math.max(1, Math.min(200, filter.pageSize ?? 50));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filter.page ?? 1), totalPages);

  const rows = all<AuditLogWithUser>(
    `SELECT a.*, u.name AS user_name, u.role AS user_role, u.avatar_color AS avatar_color
     ${from}
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    (page - 1) * pageSize,
  );

  return { rows, total, page, pageSize, totalPages };
}

export interface AuditFilterOptions {
  actions: { value: string; count: number }[];
  entities: { value: string; count: number }[];
}

/** 审计日志筛选下拉：从实际数据中取 action / entity_type */
export function getAuditFilterOptions(): AuditFilterOptions {
  return {
    actions: all<{ value: string; count: number }>(
      "SELECT action AS value, COUNT(*) AS count FROM audit_logs GROUP BY action ORDER BY count DESC, value",
    ).map((row) => ({ value: row.value, count: Number(row.count) })),
    entities: all<{ value: string; count: number }>(
      "SELECT entity_type AS value, COUNT(*) AS count FROM audit_logs GROUP BY entity_type ORDER BY count DESC, value",
    ).map((row) => ({ value: row.value, count: Number(row.count) })),
  };
}

export interface AuditStats {
  total: number;
  today: number;
  last7Days: number;
  users: number;
}

export function getAuditStats(): AuditStats {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return {
    total: Number(get<{ c: number }>("SELECT COUNT(*) AS c FROM audit_logs")?.c ?? 0),
    today: Number(
      get<{ c: number }>("SELECT COUNT(*) AS c FROM audit_logs WHERE created_at >= ?", startOfToday)?.c ?? 0,
    ),
    last7Days: Number(
      get<{ c: number }>("SELECT COUNT(*) AS c FROM audit_logs WHERE created_at >= ?", sevenDaysAgo)?.c ?? 0,
    ),
    users: Number(
      get<{ c: number }>("SELECT COUNT(DISTINCT user_id) AS c FROM audit_logs WHERE user_id IS NOT NULL")?.c ?? 0,
    ),
  };
}
