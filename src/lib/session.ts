import { SignJWT, jwtVerify } from "jose";

/**
 * 轻量会话模块：只依赖 jose，可在 middleware (edge runtime) 中使用。
 * 真正的用户加载与权限校验在 lib/auth.ts（Node runtime / DB）
 */
export const SESSION_COOKIE = "poc_workflow_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 天

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "poc-workflow-local-dev-secret-please-change",
);

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: String(payload.role ?? ""),
    };
  } catch {
    return null;
  }
}
