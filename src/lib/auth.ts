import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, get } from "@/lib/db/client";
import { can, PERMISSION_DENIED_MESSAGE, type Permission } from "@/lib/rbac";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "@/lib/session";
import type { User } from "@/lib/types";

/** 从会话 cookie 加载当前用户（含 active 校验） */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;
  const user = get<User>("SELECT * FROM users WHERE id = ? AND active = 1", Number(payload.sub));
  return user ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** 页面级权限守卫：无权限时跳转到总览页并提示 */
export async function requirePermission(permission: Permission): Promise<User> {
  const user = await requireUser();
  if (!can(user, permission)) {
    redirect(`/dashboard?denied=${encodeURIComponent(PERMISSION_DENIED_MESSAGE)}`);
  }
  return user;
}

/** Server Action 中的权限断言：直接抛错，由调用方或错误边界处理 */
export function assertPermission(user: User | null, permission: Permission): User {
  if (!user) throw new Error("会话已过期，请重新登录");
  if (!can(user, permission)) throw new Error(PERMISSION_DENIED_MESSAGE);
  return user;
}

export async function establishSession(user: User): Promise<void> {
  const token = await signSession({
    sub: String(user.id),
    email: user.email,
    name: user.name,
    role: user.role,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export interface CredentialResult {
  user: User | null;
  error?: string;
}

export async function verifyCredentials(email: string, password: string): Promise<CredentialResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) return { user: null, error: "请输入邮箱和密码" };
  const user = get<User>("SELECT * FROM users WHERE lower(email) = ?", normalized);
  if (!user) return { user: null, error: "账号不存在，请使用页面下方的演示账号" };
  if (!user.active) return { user: null, error: "该账号已被禁用，请联系管理员" };
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return { user: null, error: "密码错误，请重试" };
  getDb().prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(new Date().toISOString(), user.id);
  return { user };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
