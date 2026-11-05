import { all } from "@/lib/db/client";
import type { Project, PublicUser } from "@/lib/types";

/** 当前演示项目（单项目 PoC） */
export function getProject(): Project {
  const project = all<Project>("SELECT * FROM projects ORDER BY id LIMIT 1")[0];
  if (!project) throw new Error("项目数据尚未初始化，请运行 pnpm db:seed");
  return project;
}

export function listUsers(): PublicUser[] {
  return all<PublicUser>(
    "SELECT id, email, name, role, title, avatar_color, active, created_at, last_login_at FROM users WHERE active = 1 ORDER BY id",
  );
}

/** 用户 id -> 用户信息（列表渲染姓名/头像用） */
export function getUserMap(): Map<number, PublicUser> {
  const map = new Map<number, PublicUser>();
  for (const row of all<PublicUser>(
    "SELECT id, email, name, role, title, avatar_color, active, created_at, last_login_at FROM users",
  )) {
    map.set(row.id, row);
  }
  return map;
}
