/**
 * 端到端冒烟测试（需要 dev server 在 3000 端口运行）
 *
 *   node scripts/smoke.mjs
 *
 * 覆盖：登录页、四角色登录后的核心路由、权限拦截、AI 问答 fallback、关键内容关键词。
 */
import { SignJWT } from "jose";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "poc-workflow-local-dev-secret-please-change",
);

/** 种子用户（id 与 seed-core 一致；如未按默认顺序 seed，请调整） */
const USERS = {
  admin: { id: 1, email: "admin@demo.dev", name: "周瑾", role: "admin" },
  pm: { id: 2, email: "pm@demo.dev", name: "林晓", role: "pm" },
  tech: { id: 3, email: "tech@demo.dev", name: "陈默", role: "tech" },
  test: { id: 5, email: "test@demo.dev", name: "苏晴", role: "test" },
};

async function tokenFor(key) {
  const user = USERS[key];
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(SECRET);
}

const results = [];

async function check({ label, path, role, locale = "en", status = 200, contains = [], redirectTo = null, method = "GET", body = null }) {
  try {
    const headers = { "user-agent": "poc-smoke", cookie: `traceflow_locale=${locale}` };
    if (role) headers.cookie += `; poc_workflow_session=${await tokenFor(role)}`;
    if (body) headers["content-type"] = "application/json";
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(60000),
    });
    const text = response.headers.get("content-type")?.includes("application/json")
      ? JSON.stringify(await response.json())
      : await response.text();

    const problems = [];
    const expectedStatus = redirectTo ? [301, 302, 303, 307, 308] : [status];
    if (!expectedStatus.includes(response.status)) {
      problems.push(`status ${response.status}（期望 ${expectedStatus.join("/")}）`);
    }
    if (redirectTo) {
      const location = response.headers.get("location") ?? "";
      if (!location.includes(redirectTo)) problems.push(`location ${location || "缺失"}（期望包含 ${redirectTo}）`);
    }
    for (const keyword of contains) {
      if (!text.includes(keyword)) problems.push(`缺少关键词「${keyword}」`);
    }
    if (path === "/api/ask" && response.status === 200) {
      const data = JSON.parse(text);
      if (!data.answer || !Array.isArray(data.citations) || !data.citations.length) {
        problems.push("Expected an answer with source citations");
      }
    }
    results.push({ label, ok: problems.length === 0, problems, status: response.status });
  } catch (error) {
    results.push({ label, ok: false, problems: [error.message], status: 0 });
  }
}

const ROUTES = [
  { label: "登录页（英文）", path: "/login", status: 200, contains: ["TraceFlow", "Sign in to your workspace", "One-click demo sign-in"] },
  { label: "登录页（中文）", path: "/login", locale: "zh-CN", status: 200, contains: ["TraceFlow", "登录工作台", "一键演示登录"] },
  { label: "根路径跳登录", path: "/", redirectTo: "/login" },

  { label: "总览（admin）", path: "/dashboard", role: "admin", contains: ["Project overview", "Milestones", "TraceFlow"] },
  { label: "需求列表（pm）", path: "/requirements", role: "pm", contains: ["Requirements"] },
  { label: "需求详情（pm）", path: "/requirements/3", role: "pm", contains: ["订单超时自动关闭与库存释放"] },
  { label: "任务看板（pm）", path: "/tasks", role: "pm", contains: ["Tasks"] },
  { label: "任务详情（pm）", path: "/tasks/3", role: "pm", contains: [] },

  { label: "代码模块列表（tech）", path: "/code", role: "tech", contains: ["Code modules"] },
  { label: "代码模块详情（tech）", path: "/code/1", role: "tech", contains: ["订单服务"] },
  { label: "变更列表（tech）", path: "/changes", role: "tech", contains: ["Change center"] },
  { label: "变更详情 CR-002（tech）", path: "/changes/2", role: "tech", contains: ["15 分钟", "Impact analysis"] },
  { label: "变更详情 CR-004（tech）", path: "/changes/4", role: "tech", contains: ["Impact analysis"] },

  { label: "用例列表（test）", path: "/tests", role: "test", contains: ["Test cases"] },
  { label: "用例详情（test）", path: "/tests/3", role: "test", contains: ["30 分钟"] },
  { label: "回归列表（test）", path: "/regression", role: "test", contains: ["Regression plans"] },
  { label: "回归详情 RP-001（test）", path: "/regression/1", role: "test", contains: ["Execution progress"] },
  { label: "回归详情 RP-002（test）", path: "/regression/2", role: "test", contains: ["银联"] },
  { label: "新建回归（test）", path: "/regression/new", role: "test", contains: [] },

  { label: "知识库列表", path: "/docs", role: "pm", contains: ["Knowledge documents"] },
  { label: "知识库详情", path: "/docs/order-timeout-prd", role: "pm", contains: ["订单超时关闭规则"] },
  { label: "新建文档", path: "/docs/new", role: "pm", contains: [] },
  { label: "AI 问答页", path: "/ask", role: "pm", contains: ["Knowledge Q&amp;A"] },

  { label: "用户管理（admin）", path: "/admin/users", role: "admin", contains: ["User management"] },
  { label: "审计日志（admin）", path: "/admin/audit", role: "admin", contains: ["Audit log"] },
  { label: "用户管理（pm 应被拦截）", path: "/admin/users", role: "pm", redirectTo: "/dashboard" },
  { label: "未登录访问需求（应跳登录）", path: "/requirements", redirectTo: "/login" },
];

console.log(`\n🔍 冒烟测试 ${BASE}\n`);
for (const route of ROUTES) {
  await check(route);
}

// AI 问答 fallback
await check({
  label: "AI 问答 API（fallback）",
  path: "/api/ask",
  role: "pm",
  method: "POST",
  body: { question: "订单超时关闭现在是多少分钟？会影响哪些测试用例？" },
});
const passed = results.filter((result) => result.ok).length;
const failed = results.length - passed;
console.log(
  results
    .map((result) => {
      const icon = result.ok ? "✅" : "❌";
      const detail = result.ok ? (result.note ?? "") : result.problems.join("；");
      return `${icon} ${result.label.padEnd(26)} ${String(result.status).padEnd(4)} ${detail}`;
    })
    .join("\n"),
);
console.log(`\n结果：${passed}/${results.length} 通过，${failed} 失败\n`);
process.exit(failed > 0 ? 1 : 0);
