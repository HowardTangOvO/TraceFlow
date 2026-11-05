import type { Dimension, Role, User } from "./types";

/**
 * 权限矩阵（资源级）：
 * - 各角色管理各自维度的主数据，跨维度协作默认只读
 * - 审批、用户管理、审计为管理类动作
 */
export type Permission =
  | "requirement.write"
  | "task.write"
  | "code.write"
  | "testcase.write"
  | "change.create"
  | "change.analyze"
  | "change.approve"
  | "effort.write"
  | "regression.create"
  | "regression.execute"
  | "doc.write"
  | "ai.ask"
  | "admin.users"
  | "admin.audit";

const ALL_PERMISSIONS: Permission[] = [
  "requirement.write",
  "task.write",
  "code.write",
  "testcase.write",
  "change.create",
  "change.analyze",
  "change.approve",
  "effort.write",
  "regression.create",
  "regression.execute",
  "doc.write",
  "ai.ask",
  "admin.users",
  "admin.audit",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ALL_PERMISSIONS,
  pm: [
    "requirement.write",
    "task.write",
    "change.create",
    "change.approve",
    "regression.create",
    "doc.write",
    "ai.ask",
  ],
  tech: [
    "task.write",
    "code.write",
    "change.create",
    "change.analyze",
    "effort.write",
    "doc.write",
    "ai.ask",
  ],
  test: [
    "task.write",
    "testcase.write",
    "regression.create",
    "regression.execute",
    "doc.write",
    "ai.ask",
  ],
};

export function can(user: Pick<User, "role"> | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

export function canAny(user: Pick<User, "role"> | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => can(user, p));
}

/** 任务维度的写权限：PM 管产品任务，Tech 管研发任务，Test 管测试任务，Admin 全部 */
export function canWriteDimension(user: Pick<User, "role"> | null | undefined, dimension: Dimension): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === dimension;
}

export const PERMISSION_DENIED_MESSAGE = "当前角色没有执行该操作的权限，请联系管理员。";
