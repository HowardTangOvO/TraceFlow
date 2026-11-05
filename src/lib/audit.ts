import { run } from "@/lib/db/client";
import type { User } from "@/lib/types";

export type AuditAction =
  | "login"
  | "created"
  | "updated"
  | "deleted"
  | "status_changed"
  | "approved"
  | "rejected"
  | "executed"
  | "generated"
  | "asked"
  | "exported";

/** 记录审计日志（失败不阻断业务） */
export function logAudit(
  user: Pick<User, "id"> | null,
  action: AuditAction,
  entityType: string,
  entityId: number | null,
  summary: string,
): void {
  try {
    run(
      "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      user?.id ?? null,
      action,
      entityType,
      entityId ?? null,
      summary,
      new Date().toISOString(),
    );
  } catch (error) {
    console.error("[audit] 写入审计日志失败", error);
  }
}
