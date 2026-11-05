import type { DB } from "./db-types";
import { dateAt, insertRow, isoAt } from "./seed-utils";

/**
 * 种子数据 · 核心域
 * 示例项目：星云电商交易平台（SHOP）
 */
export function seedCore(db: DB): void {
  seedUsers(db);
  seedProjectAndMilestones(db);
  seedRequirements(db);
  seedTasks(db);
}

function seedUsers(db: DB): void {
  const passwordHashes: Record<string, string> = {
    admin: hashFor("admin123"),
    pm: hashFor("pm123"),
    tech: hashFor("tech123"),
    test: hashFor("test123"),
  };

  const users: Record<string, string | number>[] = [
    {
      email: "admin@demo.dev",
      name: "周瑾",
      role: "admin",
      title: "平台管理员",
      avatar_color: "indigo",
      password_hash: passwordHashes.admin,
    },
    {
      email: "pm@demo.dev",
      name: "林晓",
      role: "pm",
      title: "产品经理 · 交易方向",
      avatar_color: "blue",
      password_hash: passwordHashes.pm,
    },
    {
      email: "tech@demo.dev",
      name: "陈默",
      role: "tech",
      title: "后端负责人",
      avatar_color: "emerald",
      password_hash: passwordHashes.tech,
    },
    {
      email: "tech2@demo.dev",
      name: "周远",
      role: "tech",
      title: "前端工程师",
      avatar_color: "violet",
      password_hash: passwordHashes.tech,
    },
    {
      email: "test@demo.dev",
      name: "苏晴",
      role: "test",
      title: "测试负责人",
      avatar_color: "amber",
      password_hash: passwordHashes.test,
    },
    {
      email: "test2@demo.dev",
      name: "何雨",
      role: "test",
      title: "测试工程师",
      avatar_color: "rose",
      password_hash: passwordHashes.test,
    },
  ];

  users.forEach((user, index) => {
    insertRow(db, "users", {
      ...user,
      active: 1,
      created_at: isoAt(-240 + index * 3, 9, 30),
      last_login_at: isoAt(-Math.max(0, index - 1), 9, 0),
    });
  });
}

function hashFor(password: string): string {
  // 延迟 require，避免 seed 模块在 edge 场景被静态分析时引入 bcrypt
  const bcrypt = require("bcryptjs") as typeof import("bcryptjs");
  return bcrypt.hashSync(password, 10);
}

function seedProjectAndMilestones(db: DB): void {
  const projectId = insertRow(db, "projects", {
    key: "SHOP",
    name: "星云电商交易平台",
    description:
      "面向 B2C 场景的交易中台，覆盖商品、购物车、下单、支付、退款、风控等核心链路。当前处于「售后与退款闭环」迭代，同时推进风控规则引擎 V2。",
    status: "active",
    start_date: dateAt(-300),
    target_date: dateAt(60),
    created_at: isoAt(-300, 9, 0),
  });

  const milestones: Array<[string, string, string, string, number]> = [
    ["交易内核一期", "购物车、下单、库存锁定、订单状态机落地", dateAt(-180), "done", 100],
    ["支付渠道整合", "微信支付 / 支付宝双渠道接入，支付回调幂等", dateAt(-90), "done", 100],
    ["售后与退款闭环", "退款申请、审核、回调、原路退回全链路", dateAt(10), "in_progress", 65],
    ["风控规则引擎 V2", "规则 DSL、设备指纹、频次限制可配置化", dateAt(30), "at_risk", 40],
    ["大促压测与稳定性", "双十一流量洪峰压测、限流降级预案", dateAt(60), "planned", 0],
  ];

  milestones.forEach(([name, description, target, status, progress], index) => {
    insertRow(db, "milestones", {
      project_id: projectId,
      name,
      description,
      target_date: target,
      status,
      progress,
      created_at: isoAt(-300 + index * 20, 10, 0),
    });
  });
}

function seedRequirements(db: DB): void {
  const projectId = idByKeyLite(db, "projects", "SHOP");
  const pmId = userId(db, "pm@demo.dev");
  const techId = userId(db, "tech@demo.dev");
  const testId = userId(db, "test@demo.dev");

  const requirements: Array<{
    key: string;
    title: string;
    status: string;
    priority: string;
    owner: number;
    source: string;
    version: number;
    description: string;
    created: number;
    updated: number;
  }> = [
    {
      key: "REQ-001",
      title: "用户下单与库存锁定",
      status: "active",
      priority: "P0",
      owner: pmId,
      source: "用户访谈 / 竞品分析",
      version: 3,
      created: -280,
      updated: -12,
      description: `## 背景
交易链路的核心入口：用户从购物车进入结算页，提交订单后系统需要校验优惠、锁定库存、生成订单。

## 用户故事
作为买家，我希望在结算页确认商品、优惠和收货地址后提交订单，并获得明确的库存锁定结果。

## 验收标准
- 提交订单时按 SKU 维度锁定库存，锁定失败需给出明确提示
- 同一用户 5 秒内重复提交只生成一笔订单（幂等）
- 库存锁定有效期与订单支付超时时间一致
- 下单成功后返回订单号，并在订单中心可见

## 依赖
支付渠道（REQ-002）、优惠券（REQ-005）、风控（REQ-006）`,
    },
    {
      key: "REQ-002",
      title: "支付渠道接入（微信 / 支付宝 / 银联）",
      status: "active",
      priority: "P0",
      owner: pmId,
      source: "商业化需求",
      version: 2,
      created: -260,
      updated: -20,
      description: `## 背景
支持主流支付渠道，提升支付成功率，并完成支付回调的统一处理。

## 验收标准
- 支持微信 JSAPI / Native、支付宝网页支付、银联云闪付
- 支付回调验签、幂等、可重放
- 渠道异常时自动切换备用渠道（降级）
- 支付结果异步通知订单服务，状态机保持一致`,
    },
    {
      key: "REQ-003",
      title: "订单超时自动关闭与库存释放",
      status: "changed",
      priority: "P1",
      owner: pmId,
      source: "用户反馈 / 数据洞察",
      version: 4,
      created: -150,
      updated: -2,
      description: `## 背景
未支付订单长期占用库存，导致热门 SKU 实际可售库存偏低。需要自动关闭超时未支付订单并释放库存。

## 当前规则
- 订单创建后 **30 分钟** 未支付自动关闭
- 关闭时释放锁定库存，写入订单状态流水
- 关闭前 5 分钟发送站内信提醒（可选）

## 变更中（CR-002）
业务侧希望将超时时间从 30 分钟缩短为 **15 分钟**，并新增关闭通知。该变更正在影响分析中。

## 验收标准
- 定时任务扫描超时订单，关闭动作幂等
- 库存释放与订单关闭在同一事务语义内，不出现超卖
- 关闭后用户再次支付应被拦截并提示订单已关闭`,
    },
    {
      key: "REQ-004",
      title: "退款申请与审核流程",
      status: "active",
      priority: "P1",
      owner: pmId,
      source: "售后业务规划",
      version: 2,
      created: -120,
      updated: -8,
      description: `## 背景
售后场景需要支持用户发起退款申请，客服/商家审核后原路退回。

## 验收标准
- 用户可对已支付订单发起部分或全额退款
- 审核通过后调用支付渠道退款接口，失败自动重试 3 次
- 退款回调幂等，重复回调不重复入账
- 退款状态在订单详情页实时可见`,
    },
    {
      key: "REQ-005",
      title: "优惠券叠加与最优组合",
      status: "active",
      priority: "P1",
      owner: pmId,
      source: "营销活动需求",
      version: 2,
      created: -100,
      updated: -15,
      description: `## 背景
营销侧存在满减、折扣、平台券、店铺券多种优惠，需要计算最优组合并防止互斥券叠加。

## 验收标准
- 支持满减券、折扣券、平台券、店铺券
- 互斥规则命中时禁止同时使用
- 结算页展示优惠明细与最优组合
- 优惠金额计算前后端一致，避免下单金额被篡改`,
    },
    {
      key: "REQ-006",
      title: "风控规则引擎（设备指纹 / 频次限制）",
      status: "active",
      priority: "P0",
      owner: pmId,
      source: "安全合规",
      version: 2,
      created: -110,
      updated: -5,
      description: `## 背景
黑产薅羊毛、刷单、恶意退款给业务带来损失，需要可配置的风控规则引擎。

## 验收标准
- 支持设备指纹识别、同设备多账号检测
- 支持频次限制（如单设备 10 分钟内下单 > 20 次触发拦截）
- 规则可配置、可灰度、可回滚
- 命中规则后返回明确的风控原因，支持人工申诉`,
    },
    {
      key: "REQ-007",
      title: "订单状态机与逆向流程",
      status: "active",
      priority: "P2",
      owner: techId,
      source: "技术规划",
      version: 1,
      created: -200,
      updated: -30,
      description: `## 背景
订单状态需要覆盖正向与逆向流程，避免状态不一致。

## 验收标准
- 状态流转：待支付 → 已支付 → 待发货 → 已发货 → 已完成 / 已关闭 / 退款中 / 已退款
- 非法流转必须被拦截并记录日志
- 状态变更事件可通过消息通知下游（库存、营销、客服）`,
    },
    {
      key: "REQ-008",
      title: "用户收货地址管理",
      status: "deprecated",
      priority: "P3",
      owner: pmId,
      source: "历史需求",
      version: 1,
      created: -250,
      updated: -60,
      description: `## 说明
收货地址管理能力已合并至「用户中心」通用能力，本需求废弃，相关用例保留但标记为 deprecated。`,
    },
    {
      key: "REQ-009",
      title: "大促限流与降级预案",
      status: "draft",
      priority: "P2",
      owner: pmId,
      source: "稳定性规划",
      version: 1,
      created: -20,
      updated: -20,
      description: `## 背景
双十一大促流量预计为日常的 12 倍，需要限流、降级与熔断预案。

## 草稿要点
- 网关按接口维度限流，下单接口优先保障
- 非核心接口（推荐、评论）可降级
- 支付回调链路独立线程池，避免被大促流量挤占`,
    },
  ];

  for (const req of requirements) {
    insertRow(db, "requirements", {
      project_id: projectId,
      key: req.key,
      title: req.title,
      description_md: req.description,
      status: req.status,
      priority: req.priority,
      owner_id: req.owner,
      source: req.source,
      version: req.version,
      created_at: isoAt(req.created, 10, 0),
      updated_at: isoAt(req.updated, 16, 20),
    });
  }

  // 保证测试角色也在种子中存在（供后续模块引用）
  void testId;
}

function seedTasks(db: DB): void {
  const projectId = idByKeyLite(db, "projects", "SHOP");
  const assignees: Record<string, number> = {
    pm: userId(db, "pm@demo.dev"),
    tech: userId(db, "tech@demo.dev"),
    tech2: userId(db, "tech2@demo.dev"),
    test: userId(db, "test@demo.dev"),
    test2: userId(db, "test2@demo.dev"),
  };

  const tasks: Array<{
    key: string;
    req: string;
    title: string;
    status: string;
    dim: string;
    who: string;
    est: number;
    act: number;
    start: number;
    due: number;
    created: number;
  }> = [
    { key: "TASK-001", req: "REQ-003", title: "梳理订单超时关闭规则边界", status: "done", dim: "pm", who: "pm", est: 2, act: 2, start: -30, due: -27, created: -32 },
    { key: "TASK-002", req: "REQ-003", title: "超时关闭规则变更方案评审", status: "review", dim: "pm", who: "pm", est: 1, act: 1, start: -4, due: 2, created: -6 },
    { key: "TASK-003", req: "REQ-003", title: "订单服务超时关闭定时任务", status: "done", dim: "tech", who: "tech", est: 5, act: 6, start: -30, due: -20, created: -32 },
    { key: "TASK-004", req: "REQ-003", title: "库存释放幂等改造", status: "done", dim: "tech", who: "tech", est: 3, act: 3, start: -24, due: -18, created: -26 },
    { key: "TASK-005", req: "REQ-002", title: "支付回调幂等重构", status: "in_progress", dim: "tech", who: "tech", est: 4, act: 2, start: -6, due: 4, created: -8 },
    { key: "TASK-006", req: "REQ-005", title: "结算页优惠券选择交互", status: "done", dim: "tech", who: "tech2", est: 3, act: 3.5, start: -20, due: -12, created: -22 },
    { key: "TASK-007", req: "REQ-007", title: "订单详情页状态时间轴", status: "in_progress", dim: "tech", who: "tech2", est: 2, act: 1, start: -5, due: 3, created: -7 },
    { key: "TASK-008", req: "REQ-004", title: "退款审核页前后端联调", status: "todo", dim: "tech", who: "tech2", est: 3, act: 0, start: 2, due: 9, created: -3 },
    { key: "TASK-009", req: "REQ-003", title: "编写订单关闭回归用例", status: "done", dim: "test", who: "test", est: 2, act: 2, start: -18, due: -14, created: -20 },
    { key: "TASK-010", req: "REQ-002", title: "支付渠道回归测试", status: "in_progress", dim: "test", who: "test2", est: 3, act: 1.5, start: -3, due: 6, created: -5 },
    { key: "TASK-011", req: "REQ-006", title: "风控规则 DSL 验收测试", status: "blocked", dim: "test", who: "test2", est: 2, act: 0, start: 1, due: 8, created: -4 },
    { key: "TASK-012", req: "REQ-009", title: "大促压测方案评审", status: "todo", dim: "test", who: "test", est: 2, act: 0, start: 7, due: 12, created: -2 },
    { key: "TASK-013", req: "REQ-009", title: "压测脚本与监控大盘开发", status: "backlog", dim: "tech", who: "tech", est: 5, act: 0, start: 10, due: 20, created: -2 },
    { key: "TASK-014", req: "REQ-003", title: "订单超时通知文案与交互", status: "in_progress", dim: "pm", who: "pm", est: 1, act: 0.5, start: -2, due: 3, created: -4 },
    { key: "TASK-015", req: "REQ-006", title: "风控规则 DSL 技术方案", status: "done", dim: "tech", who: "tech", est: 4, act: 5, start: -40, due: -32, created: -42 },
    { key: "TASK-016", req: "REQ-002", title: "银联云闪付接入联调", status: "todo", dim: "tech", who: "tech2", est: 4, act: 0, start: 3, due: 10, created: -1 },
    { key: "TASK-017", req: "REQ-004", title: "退款回调幂等用例补充", status: "review", dim: "test", who: "test", est: 1, act: 1, start: -2, due: 2, created: -3 },
    { key: "TASK-018", req: "REQ-007", title: "订单状态机逆向流程梳理", status: "done", dim: "pm", who: "pm", est: 1, act: 1, start: -35, due: -33, created: -36 },
  ];

  for (const task of tasks) {
    insertRow(db, "tasks", {
      project_id: projectId,
      requirement_id: idByKeyLite(db, "requirements", task.req),
      key: task.key,
      title: task.title,
      description_md: `关联需求：${task.req}\n\n${task.title}，需在 ${dateAt(task.due)} 前完成。`,
      status: task.status,
      dimension: task.dim,
      assignee_id: assignees[task.who],
      estimate_days: task.est,
      actual_days: task.act,
      start_date: dateAt(task.start),
      due_date: dateAt(task.due),
      created_at: isoAt(task.created, 10, 0),
      updated_at: isoAt(Math.min(0, task.due), 15, 30),
    });
  }
}

function userId(db: DB, email: string): number {
  const row = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number | bigint } | undefined;
  if (!row) throw new Error(`seed: 找不到用户 ${email}`);
  return Number(row.id);
}

/** 局部 key 查询（避免与 seed-utils 循环依赖时的使用顺序问题） */
function idByKeyLite(db: DB, table: string, key: string): number {
  const row = db.prepare(`SELECT id FROM ${table} WHERE key = ?`).get(key) as { id: number | bigint } | undefined;
  if (!row) throw new Error(`seed: 找不到 ${table}.key=${key}`);
  return Number(row.id);
}
