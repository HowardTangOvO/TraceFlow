# TraceFlow

> Development Lifecycle Traceability Platform · 研发全链路追溯平台（PoC）

> 面向 **PM / Tech / Test** 三个维度的项目知识库与全链路追溯平台：
> **需求 → 代码 → 测试** 双向可追溯；需求变更时自动做**影响分析**、**Effort 评估**、**测试用例修改建议**，并生成**回归计划**、记录**执行结果**，形成闭环。

这是一个可本地一键运行的端到端 PoC，内置「星云电商交易平台」示例项目（9 条需求 / 18 个任务 / 10 个代码模块 / 20 条用例 / 5 个变更 / 3 个回归计划 / 10 篇知识文档）。

---

## Implementation status (2026-11-05)

The product is named **TraceFlow**, with the Chinese descriptor
**研发全链路追溯平台**. The sample business project, 星云电商交易平台,
is demonstration data rather than the product name.

### Languages

The login screen and application header provide a Simplified Chinese / English
selector. Chinese (`zh-CN`) is the default; English uses `en`. The preference is
stored in an HTTP-only cookie and applied consistently to server rendering,
client components, document language, page titles, dates, effort units,
validation feedback and local Q&A explanations. Changing language preserves
the current URL and authenticated session.

Translations live in `src/lib/i18n/messages/`. Server components and actions use
`getI18n()`; client components use `useI18n()`. Dynamic messages use named
placeholders such as `{count}`. Project names, requirement titles, documents,
test steps and historical evidence remain in their original language. A model
answer follows the selected interface language when a model is configured.

This internal PoC uses cookie-based language selection and keeps existing
route URLs; it does not add public localized URL prefixes or translate stored
business records. No additional dependency is required.

The application routes and mutation handlers are now implemented for requirements,
tasks, modules, changes, test cases, regression plans, documents, knowledge Q&A,
user management and audit review. The change workflow persists analysis and
estimates, requires PM approval, tracks test suggestions and regression evidence,
and checks release eligibility before marking a change implemented.

Acceptance rules:

- Changes follow `draft → analyzing → pending_approval → approved/rejected`.
  Analysis and estimates are frozen after submission.
- Testers resolve test-change suggestions. Only running regression plans accept
  execution results; each retest appends history, while summaries use the latest result.
- Required cases are included on the server and cannot be removed or skipped.
  Execution freezes plan scope. Completion requires a result for every case;
  completion can retain failures and does not imply release approval.
- Implementation requires resolved suggestions and the latest non-aborted
  regression to be completed, with required cases passing and no failed, blocked
  or unexecuted cases. Optional skipped cases remain visible.
- Document edits check versions to reject stale writes. Admin changes preserve
  at least one active administrator. Disabling an account invalidates access
  even when its session cookie has not expired.

Verification is deliberately separate from HTTP/browser validation:

```bash
pnpm typecheck
pnpm exec node scripts/verify-workflow.cjs
# Requires an already running application:
pnpm exec node scripts/smoke.mjs
```

The offline verifier uses a disposable seeded SQLite database and real business
handlers, queries and page components. It substitutes Next's request cookie
context, redirects and cache invalidation. It verifies the complete workflow,
permission denials, invalid transitions, retest history, stale release evidence,
document versions, Q&A fallback, exports and server-page HTML rendering.
It does not start Next, modify `data/app.db`, use model credentials or replace
HTTP/browser verification. This delivery passed type checking and the offline
verifier; a Next build and browser smoke test were not run.

## 一、核心能力

| 维度 | 能力 |
| --- | --- |
| **PM 维度** | 需求全生命周期（草稿/进行中/变更中/已废弃）、需求-任务-代码-用例追溯、任务看板（拖拽改状态）、工时预估 vs 实际、里程碑进度 |
| **Tech 维度** | 代码模块库、需求↔模块↔用例映射、变更中心：影响分析（规则引擎自动推断受影响模块）、Effort 评估（规则 / 历史校准 / AI 辅助 / 人工确认四路）、审批流 |
| **Test 维度** | 测试用例库（功能/回归/边界/集成/性能）、用例↔需求↔代码追溯、回归计划自动推荐（需求关联 40 + 代码覆盖 30 + 风险 20 + 历史 10）、执行记录与通过率 |
| **知识库** | PRD / 技术方案 / 测试策略 / 流程规范统一用 **Markdown** 沉淀，支持检索、导出 `.md`、与需求/模块关联 |
| **AI 问答** | 基于知识库的检索增强问答：本地多表检索 + LLM 组织答案并给出引用；**未配置模型 Key 时自动降级为本地检索模式**，功能不中断 |
| **权限与审计** | Admin / PM / Tech / Test 四角色 + 资源级权限；关键操作写入审计日志 |

### 变更闭环（核心链路）

```
需求变更申请 CR
  → 影响分析（受影响代码模块 / 层级 / 预估人天）
  → Effort 评估（规则引擎基线 + 历史同类变更校准 + AI 拆解建议 + 研发人工确认）
  → 审批（PM / Admin）
  → 测试用例修改建议（哪些用例要改 / 新增 / 废弃）
  → 生成回归计划（按评分自动推荐用例，必测标记）
  → 执行回归、记录 pass/fail/blocked 与缺陷号
  → 通过率汇总，追溯变更是否安全上线
```

---

## 二、快速开始

### 环境要求

- Node.js **≥ 20.19**（推荐 20 LTS 或 22 LTS）
- pnpm 10+

> 说明：项目使用 `better-sqlite3`（原生模块）而不是实验性的 `node:sqlite`，因此 Node 20/22 均可运行。

### 启动

```bash
cd TraceFlow
pnpm install          # 安装依赖（better-sqlite3 会自动拉取预编译二进制）
pnpm dev              # http://localhost:3000
```

首次启动会自动创建 `data/app.db` 并**自动灌入示例数据**，开箱即用。

重置数据：

```bash
pnpm db:reset         # 删除数据库并重新灌入示例数据（重置后需重启 dev server）
```

生产构建验证：

```bash
pnpm build && pnpm start
```

### 演示账号（密码 = 角色 + 123）

| 角色 | 邮箱 | 密码 | 能看到 |
| --- | --- | --- | --- |
| 管理员 Admin | `admin@demo.dev` | `admin123` | 全部 + 用户管理 + 审计日志 |
| 产品 PM | `pm@demo.dev` | `pm123` | 需求、任务、变更审批、知识库 |
| 研发 Tech | `tech@demo.dev` | `tech123` | 代码模块、影响分析、Effort 评估 |
| 测试 Test | `test@demo.dev` | `test123` | 用例库、回归计划与执行 |

登录页有「一键演示登录」按钮，点击即可进入对应角色。另有 `tech2@demo.dev`、`test2@demo.dev`（同密码）用于展示多用户场景。

---

## 三、推荐演示路径（5 分钟）

1. **PM 视角**：`/dashboard` 看里程碑与任务进度 → `/requirements` 打开 `REQ-003 订单超时自动关闭与库存释放`，查看它关联的任务 / 代码模块 / 测试用例 / 变更，以及「变更中」状态。
2. **Tech 视角**：切换 `tech@demo.dev` → `/changes/2`（`CR-002 超时时间 30 分钟 → 15 分钟`）：重新执行影响分析 → 查看规则引擎 Effort 与历史校准 / AI 辅助（无 Key 自动降级）→ 生成测试用例修改建议 → 提交审批。
3. **PM 审批**：切回 PM 账号 → `/changes/2` 审批通过，确认最终 Effort。
4. **Test 视角**：切换 `test@demo.dev` → `/regression/2`（银联渠道回归，执行中）：提交一条用例结果，观察进度与通过率变化；或从 `/regression/new?change=2` 基于变更自动推荐用例生成新计划。
5. **知识库 / AI**：`/docs` 浏览 PRD 与技术方案；`/ask` 提问「订单超时关闭现在是多少分钟？会影响哪些测试用例？」——无 Key 时给出带引用的本地检索答案，配置 Key 后由大模型组织答案。
6. **管理**：`admin@demo.dev` → `/admin/users` 启用/禁用用户、改角色；`/admin/audit` 查看所有关键操作留痕；侧边栏/顶栏可切换亮/暗主题。

---

## 四、技术栈与设计决策

| 选择 | 说明 |
| --- | --- |
| **Next.js 15 App Router + React 19 + TS 5.9** | 全栈一体：Server Components 直连数据库，Server Actions 处理写操作，无需独立后端 |
| **SQLite（better-sqlite3）** | 单文件、零运维、事务与 SQL 查询；适合知识库这类**强关联**数据。表结构与关系见 `src/lib/db/schema.ts` |
| **Markdown 文档存库、可导出** | 文档正文用 Markdown 存储/渲染，支持一键导出 `.md` 进 Git；结构化关系（追溯、状态、权限）留在 SQLite，避免用 front-matter 手写 ID |
| **Tailwind CSS v4 + 自研 UI 组件** | 无重依赖、亮/暗主题、风格统一（Linear/Notion 风）；图表为纯 SVG 实现 |
| **认证：JWT（jose）+ httpOnly Cookie + bcryptjs** | 轻量、无外部服务；Middleware 做路由保护，页面/Action 做二次权限校验 |
| **AI：DeepSeek / OpenAI 兼容** | 统一 `src/lib/llm.ts`，环境变量配置，**无 Key 自动降级**，保证演示与开发不依赖外部服务 |

### 目录结构

```
TraceFlow/
├── data/app.db                 # SQLite 数据（首次启动自动生成）
├── scripts/seed.ts             # 种子脚本（pnpm db:seed / db:reset）
├── src/
│   ├── app/
│   │   ├── login/              # 登录
│   │   ├── (app)/              # 登录后工作台（侧边栏 + 顶栏）
│   │   │   ├── dashboard/      # 项目总览
│   │   │   ├── requirements/   # PM：需求 + 追溯
│   │   │   ├── tasks/          # PM：任务看板
│   │   │   ├── code/           # Tech：代码模块
│   │   │   ├── changes/        # Tech：变更中心（影响分析 / Effort / 审批）
│   │   │   ├── tests/          # Test：用例库
│   │   │   ├── regression/     # Test：回归计划与执行
│   │   │   ├── docs/           # 知识库
│   │   │   ├── ask/            # AI 问答
│   │   │   ├── admin/users/    # 用户管理
│   │   │   └── admin/audit/    # 审计日志
│   │   └── api/                # API 路由（AI 问答、文档导出）
│   ├── components/
│   │   ├── ui/                 # 设计系统（Button/Card/Badge/Table/…）
│   │   ├── layout/             # 侧边栏 / 顶栏 / 主题
│   │   └── features/           # 各业务模块组件
│   └── lib/
│       ├── db/                 # schema / client / 种子数据
│       ├── auth.ts / session.ts / rbac.ts   # 认证、权限
│       ├── impact.ts / effort.ts            # 影响分析、Effort 规则引擎
│       ├── regression.ts / retrieval.ts     # 回归推荐、知识检索
│       ├── llm.ts                           # LLM 客户端（含降级）
│       └── queries/                         # 各页面查询
└── DEVELOPMENT.md              # 并行开发契约（数据表、组件、约定）
```

### 数据模型（核心关系）

```
requirements 1 ── n tasks
requirements n ── n code_modules      （requirement_code_links）
requirements n ── n test_cases        （test_case_requirement_links）
code_modules n ── n test_cases        （test_case_code_links）
change_requests 1 ── n change_code_impacts ── code_modules
change_requests 1 ── n effort_estimates      （rule/history/manual/llm）
change_requests 1 ── n test_change_suggestions ── test_cases
change_requests 1 ── n regression_plans
regression_plans 1 ── n regression_plan_cases ── test_cases
regression_plans 1 ── n test_runs
documents ── related_requirement / related_code_module
audit_logs ── 所有关键写操作
```

---

## 五、AI 配置（可选）

```bash
# .env.local
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

- 未配置时：`/ask` 使用本地检索 + 模板回答（带引用）；变更详情里的「AI 辅助评估」按钮会提示降级并保留规则引擎结果。
- With DeepSeek configured, the existing DeepSeek endpoint and model settings are used.
- For OpenAI, set `OPENAI_API_KEY`, optionally `OPENAI_BASE_URL` and `OPENAI_MODEL`.
  The default endpoint is `https://api.openai.com/v1`; the default model is
  `gpt-4.1-mini`. DeepSeek takes precedence when both provider keys are present.
- Live model calls have not been exercised in this delivery. The client uses the
  [Chat Completions API](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create).
  Missing credentials, failed requests or invalid effort output fall back to local results.

---

## 六、常用命令

```bash
pnpm dev          # 开发服务器
pnpm build        # 生产构建（含类型检查前的编译）
pnpm start        # 生产模式启动（需先 build）
pnpm typecheck    # TypeScript 类型检查
pnpm exec node scripts/verify-workflow.cjs  # Isolated workflow verification
pnpm db:seed      # 空库时灌入示例数据
pnpm db:reset     # 重置数据库（删除 + 重新灌入）
```

---

## 七、已验证范围与已知限制

**Verified in this delivery:** TypeScript checking and isolated SQLite workflow verification, including server-page static rendering. HTTP routing, Server Action transport, browser interactions, live model responses and production build remain unverified. See the implementation status above for exact coverage.

**已知限制（PoC 取舍）**：
- 单项目、单实例；未做并发写冲突处理与数据分页级性能优化（示例数据量级下无影响）。
- 影响分析基于「需求-代码-用例」显式映射 + 规则启发式，而非真实 Git diff / AST 静态分析（接入方式见下）。
- 回归执行记录为手工填写，未接入 CI；AI 问答为关键词检索，未使用向量嵌入。
- 导出 `.md` 为单篇导出；未实现整库导出。

**后续可扩展**：接入本地 Git 仓库读取 commit/diff、GitHub/GitLab PR 与 CI 状态、Jira/Linear 需求同步、JUnit XML 结果回写、向量检索与真正 RAG、多项目/多租户与审批流配置化。

---

## 八、给二次开发者的说明

- 表结构、组件库、Server Action 约定、文件归属都写在 [`DEVELOPMENT.md`](./DEVELOPMENT.md)，改代码前先读。
- 所有枚举的标签与颜色集中在 `src/lib/constants.ts`，不要在页面里硬编码中文状态。
- 所有写操作必须经过 Server Action 并做权限校验 + 审计日志。
- 数据库文件与 `.env.local` 已加入 `.gitignore`；示例数据由 `src/lib/db/seed-*.ts` 生成，可安全修改后 `pnpm db:reset`。
