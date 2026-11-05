import type { User } from "./types";

/** 可安全传入客户端组件的最小用户信息（不含密码哈希） */
export type Viewer = Pick<User, "id" | "name" | "role" | "title" | "avatar_color">;

export function toViewer(user: User): Viewer {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    title: user.title,
    avatar_color: user.avatar_color,
  };
}
