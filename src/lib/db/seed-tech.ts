import type { DB } from "./db-types";
import { dateAt, idByKey, insertRow, isoAt, jsonText } from "./seed-utils";

/** 种子数据 · Tech 域：代码模块、需求-代码追溯、变更申请、影响分析、Effort 评估、用例修改建议 */

export function seedCodeModules(db: DB): void {
  const projectId = idByKey(db, "projects", "SHOP");
  const chen = userId(db, "tech@demo.dev");
  const zhou = userId(db, "tech2@demo.dev");

  const modules: Array<{
    key: string;
    name: string;
    path: string;
    language: string;
    layer: string;
    owner: number;
    loc: number;
    risk: string;
    description: string;
  }> = [
    {
      key: "MOD-001",
      name: "订单服务",
      path: "services/order/OrderService.ts",
      language: "TypeScript",
      layer: "backend",
      owner: chen,
      loc: 4200,
      risk: "high",
      description: `订单创建、状态机流转、超时关闭定时任务。\n\n关键类：\`OrderService\`、\`OrderStateMachine\`、\`OrderTimeoutJob\`。\n\n数据库表：\`orders\`、\`order_items\`、\`order_state_log\`。`,
    },
    {
      key: "MOD-002",
      name: "支付网关",
      path: "services/payment/PaymentGateway.ts",
      language: "TypeScript",
      layer: "backend",
      owner: chen,
      loc: 2800,
      risk: "high",
      description: `统一支付渠道适配层：微信、支付宝、银联。\n\n包含回调验签、幂等表 \`payment_notify_log\`、渠道降级策略。`,
    },
    {
      key: "MOD-003",
      name: "库存服务",
      path: "services/inventory/InventoryService.ts",
      language: "TypeScript",
      layer: "backend",
      owner: chen,
      loc: 1600,
      risk: "medium",
      description: `SKU 库存锁定 / 释放 / 回滚，基于 Redis 原子操作 + 数据库最终一致。`,
    },
    {
      key: "MOD-004",
      name: "退款服务",
      path: "services/refund/RefundService.ts",
      language: "TypeScript",
      layer: "backend",
      owner: chen,
      loc: 1200,
      risk: "medium",
      description: `退款单创建、审核状态机、渠道退款调用与失败重试。`,
    },
    {
      key: "MOD-005",
      name: "风控引擎",
      path: "services/risk/RiskEngine.ts",
      language: "TypeScript",
      layer: "backend",
      owner: chen,
      loc: 3400,
      risk: "high",
      description: `设备指纹、频次限制、规则 DSL 执行器。规则配置存储于 \`risk_rules\` 表，支持灰度发布。`,
    },
    {
      key: "MOD-006",
      name: "结算页前端",
      path: "web/checkout/CheckoutPage.tsx",
      language: "TypeScript",
      layer: "frontend",
      owner: zhou,
      loc: 2100,
      risk: "medium",
      description: `购物车结算、优惠计算展示、地址选择、提交订单交互。`,
    },
    {
      key: "MOD-007",
      name: "订单中心前端",
      path: "web/order/OrderDetail.tsx",
      language: "TypeScript",
      layer: "frontend",
      owner: zhou,
      loc: 1800,
      risk: "medium",
      description: `订单列表、订单详情、状态时间轴、退款入口。`,
    },
    {
      key: "MOD-008",
      name: "订单分库分表",
      path: "db/schema/order_sharding.sql",
      language: "SQL",
      layer: "data",
      owner: chen,
      loc: 900,
      risk: "high",
      description: `orders 按 user_id 哈希分 16 库 64 表；超时关闭任务按分片扫描。`,
    },
    {
      key: "MOD-009",
      name: "Redis 缓存集群",
      path: "infra/redis/cluster.yaml",
      language: "YAML",
      layer: "infra",
      owner: chen,
      loc: 300,
      risk: "low",
      description: `库存锁定、分布式锁、限流计数器的缓存基础设施。`,
    },
    {
      key: "MOD-010",
      name: "API 网关",
      path: "gateway/ApiGateway.ts",
      language: "TypeScript",
      layer: "backend",
      owner: chen,
      loc: 1500,
      risk: "medium",
      description: `鉴权、限流、灰度路由、渠道降级开关。`,
    },
  ];

  for (const mod of modules) {
    insertRow(db, "code_modules", {
      project_id: projectId,
      key: mod.key,
      name: mod.name,
      path: mod.path,
      language: mod.language,
      layer: mod.layer,
      description_md: mod.description,
      owner_id: mod.owner,
      loc: mod.loc,
      risk: mod.risk,
      created_at: isoAt(-280, 11, 0),
      updated_at: isoAt(-5, 18, 0),
    });
  }

  const links: Array<[string, string, string]> = [
    ["REQ-001", "MOD-001", "订单创建与状态机核心实现"],
    ["REQ-001", "MOD-003", "下单时锁定库存"],
    ["REQ-001", "MOD-006", "结算页提交订单入口"],
    ["REQ-001", "MOD-010", "下单接口路由与限流"],
    ["REQ-002", "MOD-002", "支付渠道统一适配"],
    ["REQ-002", "MOD-010", "支付回调路由"],
    ["REQ-002", "MOD-009", "支付幂等键缓存"],
    ["REQ-003", "MOD-001", "超时关闭定时任务"],
    ["REQ-003", "MOD-003", "关闭后释放库存"],
    ["REQ-003", "MOD-008", "定时任务分片扫描"],
    ["REQ-004", "MOD-004", "退款申请与审核状态机"],
    ["REQ-004", "MOD-007", "订单详情退款入口"],
    ["REQ-005", "MOD-006", "优惠计算与展示"],
    ["REQ-005", "MOD-001", "下单金额校验"],
    ["REQ-006", "MOD-005", "风控规则执行"],
    ["REQ-006", "MOD-010", "风控前置拦截"],
    ["REQ-007", "MOD-001", "订单状态机"],
    ["REQ-007", "MOD-007", "状态时间轴展示"],
    ["REQ-008", "MOD-007", "地址选择组件"],
    ["REQ-009", "MOD-010", "网关限流"],
    ["REQ-009", "MOD-009", "限流计数器"],
  ];
  for (const [req, mod, note] of links) {
    insertRow(db, "requirement_code_links", {
      requirement_id: idByKey(db, "requirements", req),
      code_module_id: idByKey(db, "code_modules", mod),
      note,
    });
  }
}

export function seedChanges(db: DB): void {
  const projectId = idByKey(db, "projects", "SHOP");
  const pmId = userId(db, "pm@demo.dev");
  const techId = userId(db, "tech@demo.dev");
  const adminId = userId(db, "admin@demo.dev");

  const changes: Array<{
    key: string;
    title: string;
    req: string;
    description: string;
    reason: string;
    type: string;
    status: string;
    risk: string;
    files: number;
    added: number;
    removed: number;
    auto: number;
    final: number | null;
    createdBy: number;
    approvedBy: number | null;
    created: number;
    approved: number | null;
    updated: number;
  }> = [
    {
      key: "CR-001",
      title: "订单超时自动关闭与库存释放（一期）",
      req: "REQ-003",
      description: `## 变更内容
1. 新增订单超时关闭定时任务，默认 30 分钟未支付自动关闭
2. 关闭时同步释放锁定的库存，释放动作幂等
3. 订单状态流水记录关闭原因

## 影响范围
订单服务、库存服务、订单分库分表（任务分片参数）。`,
      reason: "未支付订单长期占用库存，热门 SKU 可售库存偏低，客诉率上升 12%。",
      type: "func_change",
      status: "implemented",
      risk: "high",
      files: 12,
      added: 860,
      removed: 320,
      auto: 8.5,
      final: 9.5,
      createdBy: pmId,
      approvedBy: adminId,
      created: -60,
      approved: -52,
      updated: -40,
    },
    {
      key: "CR-002",
      title: "订单超时关闭时间由 30 分钟缩短至 15 分钟，并新增关闭通知",
      req: "REQ-003",
      description: `## 变更内容
1. 超时关闭阈值由 30 分钟调整为 **15 分钟**（配置化）
2. 订单关闭后通过站内信 + 短信通知用户
3. 关闭前 3 分钟发送提醒

## 待确认
- 短信通道是否复用现有营销通道
- 大促期间是否临时延长至 20 分钟（需与运营确认）`,
      reason: "缩短库存占用窗口，提升热门商品周转率；用户反馈关闭无提醒体验差。",
      type: "func_change",
      status: "analyzing",
      risk: "medium",
      files: 6,
      added: 180,
      removed: 95,
      auto: 0,
      final: null,
      createdBy: pmId,
      approvedBy: null,
      created: -2,
      approved: null,
      updated: -1,
    },
    {
      key: "CR-003",
      title: "支付渠道新增银联云闪付",
      req: "REQ-002",
      description: `## 变更内容
1. 支付网关新增银联云闪付渠道适配
2. 收银台增加渠道入口与图标
3. 支付回调验签适配银联证书

## 影响范围
支付网关、API 网关路由、收银台前端。`,
      reason: "银联用户占比约 18%，补齐渠道可提升支付成功率与客单价。",
      type: "func_change",
      status: "approved",
      risk: "medium",
      files: 8,
      added: 420,
      removed: 60,
      auto: 5,
      final: 6,
      createdBy: pmId,
      approvedBy: pmId,
      created: -20,
      approved: -18,
      updated: -10,
    },
    {
      key: "CR-004",
      title: "风控规则引擎升级为可配置 DSL",
      req: "REQ-006",
      description: `## 变更内容
1. 规则从硬编码迁移为 DSL 描述（条件、动作、优先级）
2. 支持规则灰度发布与一键回滚
3. 新增规则命中监控大盘

## 风险
规则执行器为下单主链路强依赖，需保证 P99 延迟 < 20ms。`,
      reason: "风控规则调整依赖发版，响应黑产攻击太慢；运营希望自助配置规则。",
      type: "tech_debt",
      status: "pending_approval",
      risk: "high",
      files: 15,
      added: 1200,
      removed: 700,
      auto: 12,
      final: null,
      createdBy: techId,
      approvedBy: null,
      created: -6,
      approved: null,
      updated: -2,
    },
    {
      key: "CR-005",
      title: "大促限流开关与降级预案",
      req: "REQ-009",
      description: `## 变更内容（草案）
1. 网关增加按接口维度的限流开关
2. 非核心接口支持配置化降级
3. 支付回调链路独立线程池

## 状态
草案阶段，等待产品与研发确认方案后进入影响分析。`,
      reason: "双十一大促流量预计为日常 12 倍，需要提前准备限流降级预案。",
      type: "perf",
      status: "draft",
      risk: "medium",
      files: 4,
      added: 150,
      removed: 20,
      auto: 0,
      final: null,
      createdBy: pmId,
      approvedBy: null,
      created: -1,
      approved: null,
      updated: -1,
    },
  ];

  for (const change of changes) {
    insertRow(db, "change_requests", {
      project_id: projectId,
      requirement_id: idByKey(db, "requirements", change.req),
      key: change.key,
      title: change.title,
      description_md: change.description,
      reason: change.reason,
      change_type: change.type,
      status: change.status,
      risk_level: change.risk,
      affected_files: change.files,
      added_lines: change.added,
      removed_lines: change.removed,
      auto_effort_days: change.auto,
      final_effort_days: change.final,
      created_by: change.createdBy,
      approved_by: change.approvedBy,
      created_at: isoAt(change.created, 10, 30),
      updated_at: isoAt(change.updated, 17, 10),
      approved_at: change.approved === null ? null : isoAt(change.approved, 14, 0),
    });
  }
}

export function seedChangeAnalysis(db: DB): void {
  const chen = userId(db, "tech@demo.dev");
  const techLead = userId(db, "tech@demo.dev");

  const impacts: Array<{ change: string; module: string; level: string; action: string; reason: string; days: number }> = [
    { change: "CR-001", module: "MOD-001", level: "high", action: "modify", reason: "新增超时关闭定时任务与状态流转逻辑", days: 4.5 },
    { change: "CR-001", module: "MOD-003", level: "high", action: "modify", reason: "关闭订单时释放库存，需保证幂等", days: 2.5 },
    { change: "CR-001", module: "MOD-008", level: "medium", action: "modify", reason: "定时任务按分片扫描订单表，需调整分片参数", days: 1.5 },
    { change: "CR-001", module: "MOD-002", level: "low", action: "modify", reason: "支付回调需识别订单已关闭状态", days: 1 },

    { change: "CR-002", module: "MOD-001", level: "high", action: "modify", reason: "超时阈值改为可配置，关闭任务与通知逻辑调整", days: 2 },
    { change: "CR-002", module: "MOD-003", level: "medium", action: "modify", reason: "库存释放时点提前，需验证并发场景", days: 0.5 },
    { change: "CR-002", module: "MOD-008", level: "medium", action: "modify", reason: "扫描周期由 5 分钟调整为 1 分钟，分片任务参数变化", days: 0.5 },
    { change: "CR-002", module: "MOD-009", level: "low", action: "modify", reason: "通知频控使用缓存计数器", days: 0.3 },

    { change: "CR-003", module: "MOD-002", level: "high", action: "modify", reason: "新增银联渠道适配器与证书验签", days: 3 },
    { change: "CR-003", module: "MOD-010", level: "medium", action: "modify", reason: "新增支付路由与降级开关配置", days: 1 },
    { change: "CR-003", module: "MOD-009", level: "low", action: "modify", reason: "渠道幂等键前缀调整", days: 0.5 },

    { change: "CR-004", module: "MOD-005", level: "high", action: "modify", reason: "规则执行器重写为 DSL 解释器，灰度发布能力", days: 8 },
    { change: "CR-004", module: "MOD-010", level: "medium", action: "modify", reason: "风控前置拦截接口协议调整", days: 2 },
    { change: "CR-004", module: "MOD-001", level: "low", action: "modify", reason: "下单链路风控调用方式适配", days: 1 },
    { change: "CR-004", module: "MOD-009", level: "low", action: "modify", reason: "规则缓存与热更新", days: 0.5 },
  ];

  for (const impact of impacts) {
    insertRow(db, "change_code_impacts", {
      change_request_id: idByKey(db, "change_requests", impact.change),
      code_module_id: idByKey(db, "code_modules", impact.module),
      impact_level: impact.level,
      action: impact.action,
      reason: impact.reason,
      estimated_days: impact.days,
    });
  }

  const ruleBreakdown = (items: Array<{ label: string; days: number; note?: string }>) => jsonText(items);

  const estimates: Array<{
    change: string;
    source: string;
    days: number;
    confidence: string;
    notes: string;
    breakdown: string;
    created: number;
  }> = [
    {
      change: "CR-001",
      source: "rule",
      days: 8.5,
      confidence: "medium",
      notes: "按受影响模块 LOC 与历史同类变更加权计算",
      breakdown: ruleBreakdown([
        { label: "代码改动（860+/320-，12 文件）", days: 5.2, note: "按 0.006 人天/行加权" },
        { label: "影响模块耦合度修正", days: 1.8, note: "3 个高耦合模块" },
        { label: "测试与联调预留", days: 1.5 },
      ]),
      created: -55,
    },
    {
      change: "CR-001",
      source: "manual",
      days: 9.5,
      confidence: "high",
      notes: "陈默人工校准：分库分表脚本验证与灰度回滚方案额外 1 人天",
      breakdown: ruleBreakdown([
        { label: "订单服务定时任务", days: 4.5 },
        { label: "库存幂等改造", days: 2.5 },
        { label: "分片任务参数与验证", days: 1.5 },
        { label: "缺陷修复与回归配合", days: 1 },
      ]),
      created: -54,
    },
    {
      change: "CR-001",
      source: "history",
      days: 8,
      confidence: "medium",
      notes: "历史同类变更（CR-2025-017 订单关闭）实际 7.6 人天，校准 +5%",
      breakdown: ruleBreakdown([
        { label: "历史基线", days: 7.6, note: "同模块同类型变更" },
        { label: "范围系数", days: 0.4, note: "本次多 3 个文件" },
      ]),
      created: -53,
    },
    {
      change: "CR-002",
      source: "rule",
      days: 3.3,
      confidence: "medium",
      notes: "规则引擎初评：代码改动 180+/95-，6 个文件，1 个高风险模块",
      breakdown: ruleBreakdown([
        { label: "代码改动（180+/95-）", days: 1.6 },
        { label: "高风险模块（订单服务）修正", days: 0.7 },
        { label: "测试与联调预留", days: 1.0 },
      ]),
      created: -2,
    },
    {
      change: "CR-002",
      source: "llm",
      days: 4,
      confidence: "low",
      notes: "AI 辅助分析 diff 建议：通知链路涉及短信供应商 SDK，预估存在额外联调成本",
      breakdown: ruleBreakdown([
        { label: "超时阈值配置化", days: 1 },
        { label: "关闭/提醒通知服务", days: 2 },
        { label: "短信通道联调与文案", days: 0.5 },
        { label: "回归与灰度观察", days: 0.5 },
      ]),
      created: -1,
    },
    {
      change: "CR-002",
      source: "history",
      days: 2.8,
      confidence: "medium",
      notes: "参考历史「超时规则参数调整」类变更均值 2.8 人天",
      breakdown: ruleBreakdown([
        { label: "历史同类变更均值", days: 2.8 },
      ]),
      created: -1,
    },
    {
      change: "CR-003",
      source: "rule",
      days: 5,
      confidence: "medium",
      notes: "按受影响模块与新增渠道代码量估算",
      breakdown: ruleBreakdown([
        { label: "代码改动（420+/60-）", days: 3.2 },
        { label: "模块耦合修正", days: 0.8 },
        { label: "测试与联调预留", days: 1.0 },
      ]),
      created: -19,
    },
    {
      change: "CR-003",
      source: "manual",
      days: 6,
      confidence: "high",
      notes: "周远人工确认：银联证书申请与沙箱联调额外 1 人天",
      breakdown: ruleBreakdown([
        { label: "支付网关适配", days: 3 },
        { label: "收银台入口", days: 1 },
        { label: "证书与沙箱联调", days: 1 },
        { label: "回归测试配合", days: 1 },
      ]),
      created: -18,
    },
    {
      change: "CR-004",
      source: "rule",
      days: 12,
      confidence: "low",
      notes: "规则执行器重写，改动量大且不可直接线性推算",
      breakdown: ruleBreakdown([
        { label: "代码改动（1200+/700-）", days: 8.5 },
        { label: "高风险模块修正", days: 2.0 },
        { label: "测试与灰度预留", days: 1.5 },
      ]),
      created: -6,
    },
    {
      change: "CR-004",
      source: "llm",
      days: 14,
      confidence: "low",
      notes: "AI 辅助：建议拆分为「DSL 解析器」「灰度发布」「监控大盘」三个子任务，风险集中在解析器",
      breakdown: ruleBreakdown([
        { label: "DSL 解析器开发", days: 6 },
        { label: "灰度发布与回滚", days: 3 },
        { label: "监控大盘", days: 2 },
        { label: "性能压测与优化", days: 2 },
        { label: "回归与灰度观察", days: 1 },
      ]),
      created: -4,
    },
    {
      change: "CR-004",
      source: "manual",
      days: 11,
      confidence: "medium",
      notes: "陈默人工校准：DSL 解析器可复用既有表达式引擎，减少 3 人天",
      breakdown: ruleBreakdown([
        { label: "DSL 解析器（复用表达式引擎）", days: 4 },
        { label: "灰度发布与回滚", days: 2.5 },
        { label: "监控大盘", days: 2 },
        { label: "性能压测", days: 1.5 },
        { label: "回归", days: 1 },
      ]),
      created: -3,
    },
  ];

  for (const estimate of estimates) {
    insertRow(db, "effort_estimates", {
      change_request_id: idByKey(db, "change_requests", estimate.change),
      source: estimate.source,
      days: estimate.days,
      breakdown_json: estimate.breakdown,
      confidence: estimate.confidence,
      notes: estimate.notes,
      created_by: estimate.source === "llm" ? techLead : chen,
      created_at: isoAt(estimate.created, 11, 20),
    });
  }
}

export function seedTestSuggestions(db: DB): void {
  const suggestions: Array<{ change: string; testCase: string; action: string; reason: string; priority: string; resolved: number }> = [
    { change: "CR-001", testCase: "TC-003", action: "update", reason: "新增超时关闭逻辑，需补充「关闭后再次支付被拦截」断言", priority: "P0", resolved: 1 },
    { change: "CR-001", testCase: "TC-004", action: "update", reason: "库存释放幂等改造，需覆盖重复关闭场景", priority: "P0", resolved: 1 },
    { change: "CR-001", testCase: "TC-013", action: "update", reason: "状态机新增「已关闭」状态流转，需补充非法流转用例", priority: "P2", resolved: 1 },

    { change: "CR-002", testCase: "TC-003", action: "update", reason: "超时阈值由 30 分钟改为 15 分钟，用例步骤与断言需同步修改", priority: "P0", resolved: 0 },
    { change: "CR-002", testCase: "TC-004", action: "update", reason: "库存释放时点提前，需验证释放与关闭的时序一致性", priority: "P0", resolved: 0 },
    { change: "CR-002", testCase: "TC-014", action: "update", reason: "订单详情页需展示关闭前提醒与关闭通知记录", priority: "P2", resolved: 0 },

    { change: "CR-003", testCase: "TC-005", action: "update", reason: "回调验签新增银联证书，需补充银联回调幂等用例", priority: "P1", resolved: 1 },
    { change: "CR-003", testCase: "TC-017", action: "update", reason: "渠道降级策略新增银联优先级，需调整断言", priority: "P0", resolved: 0 },
    { change: "CR-003", testCase: "TC-001", action: "update", reason: "收银台新增银联入口，主流程用例需覆盖渠道选择", priority: "P1", resolved: 0 },

    { change: "CR-004", testCase: "TC-011", action: "update", reason: "规则由硬编码迁移 DSL，用例需改为规则配置驱动", priority: "P0", resolved: 0 },
    { change: "CR-004", testCase: "TC-012", action: "add", reason: "新增 DSL 灰度发布与回滚场景用例", priority: "P1", resolved: 0 },
    { change: "CR-004", testCase: "TC-020", action: "update", reason: "网关风控前置拦截接口协议变化，需更新鉴权断言", priority: "P1", resolved: 0 },
  ];

  for (const item of suggestions) {
    insertRow(db, "test_change_suggestions", {
      change_request_id: idByKey(db, "change_requests", item.change),
      test_case_id: idByKey(db, "test_cases", item.testCase),
      action: item.action,
      reason: item.reason,
      priority: item.priority,
      resolved: item.resolved,
      created_at: isoAt(-2, 15, 10),
    });
  }
}

function userId(db: DB, email: string): number {
  const row = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number | bigint } | undefined;
  if (!row) throw new Error(`seed: 找不到用户 ${email}`);
  return Number(row.id);
}

export { dateAt };
