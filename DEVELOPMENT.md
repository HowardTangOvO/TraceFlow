# 开发契约（多人并行开发必读）

> 本项目正在被多个 agent 并行开发。**先读完本文，再动代码。**
> 任何与本文冲突的写法，以本文为准；需要突破契约时先给 Lead 发消息。

---

## 1. 项目概况

**TraceFlow · 研发全链路追溯平台**：PM / Tech / Test 三维知识库 + 需求 → 代码 → 测试追溯 + 变更影响分析 + Effort 评估 + 回归闭环。

- 工作目录：`/Users/hodeng/work/ctf/poc-workflow`
- 技术栈：Next.js 15.5（App Router）+ React 19 + TypeScript 5.9 + Tailwind CSS v4 + better-sqlite3
- 数据：`data/app.db`（SQLite，已灌入示例数据，勿删）
- Server policy: do not run dev/build/start/serve commands during agent verification. Use type checking and the isolated verifier; HTTP smoke tests require an application that is already running.
- 类型检查：`pnpm typecheck`
- 演示账号（密码=角色+123）：`admin@demo.dev/admin123`、`pm@demo.dev/pm123`、`tech@demo.dev/tech123`、`test@demo.dev/test123`

### 环境注意
- pnpm 执行脚本时用的是 **Node 20.19.4**；Shell 的 `node` 是 22。不要在应用代码里用 `node:sqlite`（已改用 `better-sqlite3`）。
- **不要新增 npm 依赖**、不要改 `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml`。
- **不要执行 git 操作**、不要启动额外 dev server / build 以外的长时间任务。

---

## 2. 文件归属（严禁越界写）

| 所有者 | 文件 / 目录 |
| --- | --- |
| **Lead（勿改）** | `package.json`、`next.config.ts`、`tsconfig.json`、`postcss.config.mjs`、`src/app/globals.css`、`src/app/layout.tsx`、`src/app/page.tsx`、`src/app/(app)/layout.tsx`、`src/app/(app)/actions.ts`、`src/app/(app)/dashboard/**`、`src/app/login/**`、`src/components/ui/**`、`src/components/layout/**`、`src/components/charts.tsx`、`src/lib/db/**`、`src/lib/schema`（在 db 下）、`src/lib/types.ts`、`src/lib/constants.ts`、`src/lib/utils.ts`、`src/lib/auth.ts`、`src/lib/session.ts`、`src/lib/rbac.ts`、`src/lib/audit.ts`、`src/lib/actions.ts`、`src/lib/viewer.ts`、`src/lib/nav.tsx`、`src/lib/llm.ts`、`src/lib/queries/common.ts`、`src/lib/queries/dashboard.ts`、`src/middleware.ts`、`scripts/**`、`data/**`、`README.md`、`DEVELOPMENT.md` |
| **dev-pm** | `src/app/(app)/requirements/**`、`src/app/(app)/tasks/**`、`src/components/features/pm/**`、`src/lib/queries/requirements.ts`、`src/lib/queries/tasks.ts` |
| **dev-tech** | `src/app/(app)/code/**`、`src/app/(app)/changes/**`、`src/components/features/tech/**`、`src/lib/queries/code.ts`、`src/lib/queries/changes.ts`、`src/lib/impact.ts`、`src/lib/effort.ts` |
| **dev-test** | `src/app/(app)/tests/**`、`src/app/(app)/regression/**`、`src/components/features/test/**`、`src/lib/queries/tests.ts`、`src/lib/queries/regression.ts`、`src/lib/regression.ts` |
| **dev-kb** | `src/app/(app)/docs/**`、`src/app/(app)/ask/**`、`src/app/(app)/admin/**`、`src/components/features/kb/**`、`src/lib/queries/docs.ts`、`src/lib/queries/admin.ts`、`src/lib/retrieval.ts`、`src/app/api/**` |

> 需要别组数据时**直接读 SQLite**（schema 见 §4），不要 import 别人的 lib。共享组件只能 import `@/components/ui/*`、`@/components/charts`、`@/lib/*`（Lead 所有的库）。

---

## 3. 数据层用法

```ts
import { all, get, run, tx } from "@/lib/db/client";

const rows = all<Requirement>("SELECT * FROM requirements WHERE status = ?", "active");
const one = get<Project>("SELECT * FROM projects LIMIT 1");
run("UPDATE tasks SET status = ? WHERE id = ?", "done", id);
```

- 所有实体类型在 `@/lib/types`（与表字段同名 snake_case）；`*WithMeta` 类型已定义好列表页常用 join 结果。
- `run()` 返回 `{ changes, lastInsertRowid }`。
- 多语句写操作用 `tx(() => { ... })`。
- 当前时间统一 `new Date().toISOString()`（可用 `@/lib/utils` 的 `nowIso()`）。
- 演示项目：`getProject()`（`@/lib/queries/common`）返回 `SHOP 星云电商交易平台`。
- 用户下拉：`listUsers()` / `getUserMap()`（`@/lib/queries/common`）。

### 表结构（速查，完整定义见 `src/lib/db/schema.ts`）

```
users(id,email,name,role[admin|pm|tech|test],title,avatar_color,password_hash,active,created_at,last_login_at)
projects(id,key,name,description,status,start_date,target_date,created_at)
milestones(id,project_id,name,description,target_date,status[planned|in_progress|done|at_risk],progress,created_at)
requirements(id,project_id,key,title,description_md,status[draft|active|changed|deprecated],priority[P0..P3],owner_id,source,version,created_at,updated_at)
tasks(id,project_id,requirement_id,key,title,description_md,status[backlog|todo|in_progress|review|done|blocked],dimension[pm|tech|test],assignee_id,estimate_days,actual_days,start_date,due_date,created_at,updated_at)
code_modules(id,project_id,key,name,path,language,layer[frontend|backend|data|infra],description_md,owner_id,loc,risk[low|medium|high],created_at,updated_at)
requirement_code_links(id,requirement_id,code_module_id,note)
test_cases(id,project_id,key,title,precondition_md,steps_md,expected_md,type[functional|regression|edge|integration|performance],priority,status[active|draft|deprecated],automated,owner_id,last_result[pass|fail|blocked|skipped|not_run],last_run_at,created_at,updated_at)
test_case_requirement_links(id,test_case_id,requirement_id)
test_case_code_links(id,test_case_id,code_module_id)
change_requests(id,project_id,requirement_id,key,title,description_md,reason,change_type[func_change|bug_fix|perf|tech_debt|compliance],status[draft|analyzing|pending_approval|approved|implemented|rejected],risk_level,affected_files,added_lines,removed_lines,auto_effort_days,final_effort_days,created_by,approved_by,created_at,updated_at,approved_at)
change_code_impacts(id,change_request_id,code_module_id,impact_level[low|medium|high],action[modify|add|remove],reason,estimated_days)
effort_estimates(id,change_request_id,source[rule|manual|history|llm],days,breakdown_json,confidence[low|medium|high],notes,created_by,created_at)
test_change_suggestions(id,change_request_id,test_case_id,action[update|add|remove],reason,priority,resolved,created_at)
regression_plans(id,project_id,change_request_id,key,title,status[planned|running|completed|aborted],scope_desc,created_by,created_at,started_at,completed_at)
regression_plan_cases(id,plan_id,test_case_id,recommendation_score,reason,required)
test_runs(id,plan_id,test_case_id,result,executor_id,executed_at,notes,defect_ref)
documents(id,project_id,title,slug,category[pm|tech|test|knowledge],content_md,summary,status,version,author_id,related_requirement_id,related_code_module_id,created_at,updated_at)
audit_logs(id,user_id,action,entity_type,entity_id,summary,created_at)
```

### 示例数据关键对象（写死 URL 时可用）
- 需求：`REQ-001 用户下单与库存锁定` … `REQ-009 大促限流与降级预案`（id 1–9）
- 代码模块：`MOD-001 订单服务` … `MOD-010 API 网关`（id 1–10）
- 测试用例：`TC-001` … `TC-020`（id 1–20）
- 变更：`CR-001 implemented`、`CR-002 analyzing`（变更演示主角）、`CR-003 approved`、`CR-004 pending_approval`、`CR-005 draft`（id 1–5）
- 回归计划：`RP-001 completed（6 用例，4 通过 1 失败 1 跳过）`、`RP-002 running`、`RP-003 planned`（id 1–3）
- 文档：10 篇（slug 如 `order-timeout-prd`、`regression-strategy`、`effort-estimation-guide`）

---

## 4. 认证与权限

```ts
import { requireUser, requirePermission, assertPermission } from "@/lib/auth";
import { can, canWriteDimension, ROLE_PERMISSIONS } from "@/lib/rbac";

// 页面（Server Component）：
const user = await requireUser();                       // 未登录跳 /login
const user = await requirePermission("change.approve"); // 无权限跳 /dashboard?denied=...
// 可选按钮显隐：{can(user, "requirement.write") && <Button/>}

// Server Action：
const user = await requireUser();                       // 动作内必须校验
```

角色权限（`ROLE_PERMISSIONS`）：
- `admin`：全部
- `pm`：requirement.write, task.write, change.create, change.approve, regression.create, doc.write, ai.ask
- `tech`：task.write, code.write, change.create, change.analyze, effort.write, doc.write, ai.ask
- `test`：task.write, testcase.write, regression.create, regression.execute, doc.write, ai.ask

任务维度写权限：`canWriteDimension(user, "pm"|"tech"|"test")`（admin 全通过；其余角色只等于自己维度）。

---

## 5. Server Action 约定

- 动作文件放在自己负责的目录里，首行 `"use server";`；函数参数用 `formData: FormData` 或序列化好的基础类型。
- 成功：`redirectWithSuccess(returnTo, "已保存")`；失败：`redirectWithError(returnTo, "原因")`（来自 `@/lib/actions`）。
- **不要把 `redirect()` 包在 `try/catch` 里**（redirect 靠抛异常实现）。
- 写操作后调用 `revalidatePath("/当前页")` 或 `revalidatePath("/changes")` 等，然后 redirect。
- 页面读取提示：
  ```tsx
  import { ActionBanner, readActionMessages } from "@/components/ui/alert";
  const sp = await searchParams;
  <ActionBanner {...readActionMessages(sp)} />
  ```
- 写审计：`logAudit(user, "created"|"updated"|"approved"|"executed"|…, "entity", id, "一句话摘要")`（`@/lib/audit`）。
- 必填/数字校验工具：`@/lib/actions` 的 `requiredText / optionalText / numeric / optionalId / formIds`。

---

## 6. UI 组件库（`@/components/ui`）

```tsx
import {
  Badge, StatusBadge, Button, buttonStyles,
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, SectionCard,
  Field, Input, Textarea, Select, Label, Checkbox, controlClass,
  TableWrap, Table, THead, TBody, Tr, Th, Td, TableEmpty,
  Progress, Avatar, UserLabel, EmptyState, PageHeader, PageMeta, StatCard,
  Alert, ActionBanner, readActionMessages, Markdown, TabLinks, Disclosure,
  FilterBar, SearchInput, SelectFilter, FilterActions, selectClass,
} from "@/components/ui";
import { DonutChart, BarList, Sparkline, CHART_COLORS } from "@/components/charts";
```

- **状态不要手写中文/颜色**：用 `<StatusBadge kind="requirement|priority|task|dimension|role|change|changeType|impact|impactAction|effortSource|confidence|suggestion|testResult|testType|testCaseStatus|plan|milestone|doc|docStatus|risk|layer" value={...} />`；标签映射在 `@/lib/constants`（`*_META`、`metaOptions`）。
- 详情页三栏布局参考：`grid grid-cols-1 gap-4 xl:grid-cols-3`，左主区 `xl:col-span-2`。
- 表单放进 `<Disclosure summary="新建 …">`，不弹窗、不引客户端表单库。
- 需要用客户端交互（看板拖拽、AI 对话、主题等）时加 `"use client"`，但**数据写入必须经过 server action**。
- 图标用 `lucide-react`（已安装），import 具体图标名。

---

## 7. 路由与链接约定

| 页面 | 路径 |
| --- | --- |
| 需求列表/详情 | `/requirements`、`/requirements/[id]` |
| 任务看板（+ 详情） | `/tasks`、`/tasks/[id]` |
| 代码模块列表/详情 | `/code`、`/code/[id]` |
| 变更列表/详情 | `/changes`、`/changes/[id]`（支持 `?requirement=ID` 预填） |
| 用例列表/详情 | `/tests`、`/tests/[id]` |
| 回归计划列表/详情/新建 | `/regression`、`/regression/[id]`、`/regression/new?change=ID` |
| 知识文档 | `/docs`、`/docs/[slug]`、`/docs/new`、`/docs/[slug]/edit` |
| AI 问答 | `/ask` |
| 用户管理 / 审计 | `/admin/users`、`/admin/audit` |

跨维度互链一律用数字 id：`/requirements/3`、`/code/1`、`/tests/3`、`/changes/2`、`/regression/1`、`/docs/order-timeout-prd`。

---

## 8. 验证方式

1. `pnpm typecheck` must pass across the complete project. Run `pnpm exec node scripts/verify-workflow.cjs` for isolated database, action, API and static page checks. These checks do not verify Next HTTP transport or browser interaction.
2. Optional HTTP smoke checks (only against an already running application; no server was running during the latest delivery):
   ```bash
   TOKEN=$(node .tmp/session-cookie.mjs pm@demo.dev)   # 用 Shell 的 node（22）
   curl -s -o /tmp/p.html -w "%{http_code}\n" -H "Cookie: poc_workflow_session=$TOKEN" http://localhost:3000/requirements
   grep -c "需求管理" /tmp/p.html
   ```
   角色可用：`admin@demo.dev` / `pm@demo.dev` / `tech@demo.dev` / `test@demo.dev`。
3. 服务端动作的完整链路（表单提交）可由页面上的 `<form action={...}>` 验证；尽量保证 HTML 渲染时包含预期中文关键词。
4. 不要为了自测去改 `data/app.db` 的种子数据；需要的新数据通过页面创建。

## 9. 完成标准

- 自己负责的所有路由可访问（200），无运行时错误（dev server 日志/HTML 无 error）。
- 核心交互闭环可用：新建/编辑/状态流转/关联关系写入数据库并在页面反映。
- 权限：非授权角色看不到入口或提交被拦截；所有 server action 都做了 `requireUser` + 权限校验。
- 空状态、错误提示、时间格式（`formatDate/timeAgo/formatDays`）保持一致。
- 完成后给 Lead 发消息：完成的路由、关键交互、已知限制、验证命令与结果。
