import type { DB } from "./db-types";
import { idByKey, insertRow, isoAt } from "./seed-utils";

/** 种子数据 · 知识库文档与审计日志 */

interface SeedDoc {
  title: string;
  slug: string;
  category: string;
  summary: string;
  req?: string;
  mod?: string;
  author: string;
  created: number;
  updated: number;
  content: string;
}

export function seedDocuments(db: DB): void {
  const projectId = idByKey(db, "projects", "SHOP");
  const authors = {
    pm: userId(db, "pm@demo.dev"),
    tech: userId(db, "tech@demo.dev"),
    test: userId(db, "test@demo.dev"),
    admin: userId(db, "admin@demo.dev"),
  };

  const docs: SeedDoc[] = [
    {
      title: "订单超时关闭规则 PRD（含 CR-002 变更说明）",
      slug: "order-timeout-prd",
      category: "pm",
      summary: "订单超时关闭的业务规则、验收标准，以及 CR-002 将阈值从 30 分钟调整为 15 分钟的变更背景。",
      req: "REQ-003",
      author: "pm",
      created: -140,
      updated: -2,
      content: `# 订单超时关闭规则 PRD

## 1. 目标
未支付订单会长期占用库存，导致热门 SKU 可售库存偏低。需要通过定时任务自动关闭超时订单并释放库存。

## 2. 当前已上线规则（REQ-003 v4）
- 订单创建后 **30 分钟** 未支付，自动关闭
- 关闭时释放锁定库存，写入订单状态流水
- 关闭前 5 分钟发送站内信提醒
- 关闭后用户再次支付会被拦截，提示「订单已关闭」

## 3. 变更中：CR-002
- 超时阈值从 30 分钟缩短为 **15 分钟**
- 新增关闭后的站内信 + 短信通知
- 关闭前 3 分钟发送提醒
- 大促期间是否临时延长到 20 分钟，待与运营确认

### 影响分析结论（进行中）
- 代码：订单服务超时任务、库存释放时序、分片任务扫描参数
- 测试：TC-003 超时关闭用例需改断言，TC-004 库存释放时序需复测，TC-014 时间轴需增加通知记录
- 待评估：短信通道联调成本、灰度发布观察周期

## 4. 验收标准
1. 定时任务扫描周期 ≤ 1 分钟
2. 关闭动作幂等，重复触发只释放一次库存
3. 关闭记录可在订单详情页时间轴查看
4. 关闭后支付拦截率 100%

## 5. 风险
- 阈值缩短会提高误关闭率，需关注支付成功率变化
- 通知链路的短信供应商限流需要压测`,
    },
    {
      title: "需求变更管理与影响评估流程",
      slug: "change-management-process",
      category: "knowledge",
      summary: "从变更申请、影响分析、Effort 评估、审批到回归验证的标准流程与角色职责。",
      author: "admin",
      created: -90,
      updated: -10,
      content: `# 需求变更管理与影响评估流程

## 1. 流程总览
\`\`\`
变更申请 → 影响分析 → Effort 评估 → 变更审批 → 编码实现 → 测试用例修改 → 回归计划 → 执行验证 → 关闭
\`\`\`

## 2. 角色职责
| 角色 | 职责 |
| --- | --- |
| PM | 发起变更、说明业务原因、审批优先级与排期 |
| Tech | 影响分析（代码模块）、工作量评估（规则 + 人工 + AI 辅助） |
| Test | 用例修改建议确认、回归计划制定与执行 |
| Admin | 流程治理、用户与权限、审计 |

## 3. 变更分级
- **高风险**：涉及订单、支付、库存等资金链路，或影响 3 个以上高风险模块 → 必须双人评审 + 灰度
- **中风险**：单模块功能变更，需回归相关链路
- **低风险**：文案、样式、配置调整，可快速通道上线

## 4. 影响分析要点
1. 需求追溯：通过「需求→代码→用例」映射列出受影响模块
2. 代码影响：变更文件数、增删行数、模块耦合度、历史缺陷密度
3. 测试影响：受影响模块覆盖的用例、需要新增的边界用例
4. 回归范围：核心链路必测 + 受影响链路全测 + 高风险模块专项

## 5. Effort 评估方法
- **规则引擎**：按改动规模、模块风险、耦合度给出基线人天
- **历史校准**：检索同模块同类型历史变更的实际工时做修正
- **AI 辅助**：分析 diff 与需求描述，给出任务拆解建议
- **人工确认**：研发负责人最终校准，作为排期依据

## 6. 评审记录要求
每个变更必须留下：影响模块清单、Effort 依据、用例修改说明、回归执行结果，缺一不可上线。`,
    },
    {
      title: "交易中台架构演进与模块边界",
      slug: "trading-platform-architecture",
      category: "tech",
      summary: "订单、支付、库存、退款、风控五个核心服务的边界、依赖关系与数据一致性方案。",
      req: "REQ-001",
      mod: "MOD-001",
      author: "tech",
      created: -180,
      updated: -20,
      content: `# 交易中台架构演进

## 1. 模块边界
| 服务 | 职责 | 依赖 |
| --- | --- | --- |
| 订单服务 | 订单创建、状态机、超时关闭 | 库存、支付、优惠 |
| 支付网关 | 渠道适配、回调幂等、降级 | 订单、风控 |
| 库存服务 | 锁定 / 释放 / 回滚 | Redis、DB |
| 退款服务 | 退款单、审核、重试 | 支付网关、订单 |
| 风控引擎 | 设备指纹、频次规则 | Redis、规则库 |

## 2. 数据一致性
- 下单：库存锁定成功后才创建订单，订单创建失败时补偿释放库存
- 支付：回调先落库幂等表，再驱动订单状态机，最终一致
- 关闭：订单关闭与库存释放通过本地消息表 + 定时补偿保证幂等

## 3. 已知技术债
1. 订单状态机部分状态转换写死在 service 中，缺少统一状态机 DSL
2. 风控规则硬编码，调整依赖发版（CR-004 正在解决）
3. 订单表历史数据未做冷热分离，列表查询依赖分页索引

## 4. 变更影响评估提示
修改订单服务（MOD-001）时，通常需要同步检查：库存释放幂等、支付回调拦截、订单详情时间轴、分片任务参数。`,
    },
    {
      title: "支付网关渠道接入与降级规范",
      slug: "payment-gateway-integration",
      category: "tech",
      summary: "新增支付渠道的接入步骤、回调验签、幂等设计、熔断降级与灰度发布规范。",
      req: "REQ-002",
      mod: "MOD-002",
      author: "tech",
      created: -160,
      updated: -12,
      content: `# 支付网关渠道接入规范

## 1. 接入步骤
1. 实现 \`PaymentChannelAdapter\` 接口：下单、查询、退款、验签
2. 在 \`payment_notify_log\` 中登记幂等键（渠道单号 + 通知类型）
3. 配置渠道优先级与降级开关（网关动态配置）
4. 沙箱联调并录制回调报文用于回归

## 2. 回调幂等
- 幂等键：\`channel + channel_trade_no + notify_type\`
- 重复通知直接返回成功，不重复驱动业务
- 通知处理失败进入重试队列，最多 3 次退避重试

## 3. 降级与熔断
- 主渠道连续失败 5 次或超时率 > 20% 时熔断 30 秒
- 熔断期间流量切换备用渠道，用户无感知
- 切换与恢复均需记录操作日志

## 4. 新增银联云闪付（CR-003）注意点
- 证书验签：使用银联公钥验签，需配置证书轮换
- 退款：银联退款为异步，需单独处理退款回调
- 测试：TC-005 / TC-006 / TC-007 / TC-017 必须回归，主流程 TC-001 需覆盖渠道入口`,
    },
    {
      title: "订单分库分表设计与定时任务分片",
      slug: "order-sharding-design",
      category: "tech",
      summary: "orders 按 user_id 哈希分 16 库 64 表，定时任务分片扫描参数与扩容方案。",
      req: "REQ-003",
      mod: "MOD-008",
      author: "tech",
      created: -150,
      updated: -25,
      content: `# 订单分库分表设计

## 1. 分片规则
- 分库键：\`user_id\` 哈希 → 16 库
- 分表键：\`user_id\` 哈希 → 64 表
- 订单号雪花 ID，包含分片信息，便于路由

## 2. 超时关闭任务
- 定时任务按「分片 × 时间窗口」扫描 \`status = 'PENDING_PAYMENT'\` 的订单
- 当前扫描周期：5 分钟；CR-002 要求调整为 1 分钟
- 扫描参数：\`shard_total\`、\`shard_index\`、\`window_minutes\`
- 必须保证幂等：同一订单重复扫描不会重复关闭/释放

## 3. 变更注意事项
调整扫描周期或分片数时，需同步评估：
1. 数据库扫描压力（每轮扫描行数 = 超时订单数 / 分片数）
2. 库存释放频率与 Redis 锁竞争
3. 监控告警阈值（任务执行时长、积压量）

## 4. 扩容方案
- 双倍扩容需停机迁移历史数据，建议配合大促后窗口
- 迁移期间冻结超时关闭任务，避免状态错乱`,
    },
    {
      title: "回归测试策略与用例选取规则",
      slug: "regression-strategy",
      category: "test",
      summary: "基于变更影响分析自动推荐回归用例集的规则、评分模型与执行标准。",
      author: "test",
      created: -100,
      updated: -8,
      content: `# 回归测试策略

## 1. 回归范围选取四象限
| 维度 | 说明 | 权重 |
| --- | --- | --- |
| 需求追溯 | 变更需求直接关联的用例 | 40 |
| 代码覆盖 | 受影响代码模块被哪些用例覆盖 | 30 |
| 风险等级 | 高风险模块与 P0 用例 | 20 |
| 历史缺陷 | 该模块历史缺陷密度与失败用例 | 10 |

## 2. 推荐分数计算
\`\`\`
score = 40 * 需求关联权重 + 30 * 代码覆盖权重 + 20 * 风险权重 + 10 * 历史权重
\`\`\`
- score ≥ 80：必测（required）
- 60 ≤ score < 80：建议执行
- score < 60：可选

## 3. 执行标准
- P0 用例必须 100% 通过才允许上线
- 失败用例必须关联缺陷单号
- 阻塞用例需说明阻塞原因与预计解决时间
- 回归计划完成后自动汇总通过率，低于 95% 不允许发布

## 4. 自动化策略
- 核心链路（下单、支付、退款回调）优先自动化
- 边界与风控场景保持手工探索 + 用例沉淀
- 自动化用例执行结果回写系统，失败自动提单`,
    },
    {
      title: "演示环境与账号说明",
      slug: "demo-guide",
      category: "knowledge",
      summary: "PoC 演示环境启动方式、种子账号、数据重置与 AI 问答配置说明。",
      author: "admin",
      created: -30,
      updated: -1,
      content: `# 演示环境与账号说明

## 1. 启动方式
\`\`\`bash
pnpm install
pnpm dev        # http://localhost:3000
\`\`\`

首次启动会自动创建 \`data/app.db\` 并灌入示例数据。重置数据：

\`\`\`bash
pnpm db:reset
\`\`\`

## 2. 演示账号
| 角色 | 邮箱 | 密码 |
| --- | --- | --- |
| 管理员 | admin@demo.dev | admin123 |
| 产品经理 | pm@demo.dev | pm123 |
| 研发 | tech@demo.dev | tech123 |
| 测试 | test@demo.dev | test123 |

## 3. AI 问答
- 默认无需 Key：使用本地检索 + 模板回答，可完整演示
- 配置 \`DEEPSEEK_API_KEY\` 后自动启用大模型回答，并展示引用来源

## 4. 推荐演示路径
1. 用 PM 账号进入「项目总览」查看里程碑与任务进度
2. 打开「变更中心」→ CR-002，查看影响分析、Effort 评估与用例修改建议
3. 用 Tech 账号打开代码模块，查看需求/用例双向追溯
4. 用 Test 账号进入「回归测试」，查看 RP-002 执行进度与通过率
5. 进入「知识库 → AI 问答」，提问：订单超时关闭现在是多少分钟？会影响哪些测试用例？`,
    },
    {
      title: "风控规则引擎 V2 技术方案（DSL 化）",
      slug: "risk-engine-dsl",
      category: "tech",
      summary: "规则 DSL 的语法、执行器架构、灰度发布与性能要求，对应 CR-004。",
      req: "REQ-006",
      mod: "MOD-005",
      author: "tech",
      created: -45,
      updated: -4,
      content: `# 风控规则引擎 V2 技术方案

## 1. 背景
当前规则硬编码在 \`RiskEngine.ts\` 中，调整规则需要发版，无法快速响应黑产攻击。CR-004 计划将规则迁移为可配置 DSL。

## 2. DSL 设计
\`\`\`yaml
rule_id: R-1001
name: 高频下单拦截
priority: 100
condition:
  all:
    - device_order_count_10m: { gte: 20 }
    - order_amount: { gte: 100 }
action: {"type": "block", "code": "RISK_HIGH_FREQ"}
gray:
  percent: 10
  whitelist: ["vip"]
\`\`\`

## 3. 执行器架构
1. 规则加载：启动时全量加载，变更时热更新 + 版本号校验
2. 条件求值：AST 解释执行，禁止任意脚本执行（安全）
3. 动作执行：拦截 / 挑战（验证码）/ 放行 / 人工审核
4. 监控：规则命中率、耗时 P99、灰度效果对比

## 4. 性能要求
- 单次规则评估 P99 < 20ms
- 规则全量加载 < 500ms
- 下单主链路不允许因规则引擎故障而阻塞（降级为放行 + 告警）

## 5. 测试影响
- TC-011 高频下单拦截：改为通过规则配置驱动
- TC-012 同设备多账号：需新增 DSL 灰度场景
- TC-020 网关鉴权限流：接口协议可能变化`,
    },
    {
      title: "变更影响分析与工作量评估规范",
      slug: "effort-estimation-guide",
      category: "knowledge",
      summary: "规则引擎估算公式、历史数据校准方法、AI 辅助分析与人工评审要求。",
      author: "admin",
      created: -70,
      updated: -6,
      content: `# 变更影响分析与工作量评估规范

## 1. 估算输入
| 输入 | 来源 | 说明 |
| --- | --- | --- |
| 变更文件数 | 变更申请 | 影响面广度 |
| 增删行数 | 变更申请 | 代码规模 |
| 受影响模块 | 影响分析 | 按模块风险加权 |
| 历史同类变更 | 变更库 | 实际工时校准 |
| 测试与联调 | 经验系数 | 通常占开发量 25%-35% |

## 2. 规则引擎公式（基线）
\`\`\`
base = (added_lines + removed_lines) * 0.006
      + affected_modules * 0.4
      + high_risk_modules * 1.0
      + test_factor * base
\`\`\`
- 高风险模块系数 1.5、中风险 1.2、低风险 1.0
- 结果向上取 0.5 人天

## 3. 历史校准
- 检索同模块、同变更类型的已完成变更实际工时
- 取最近 5 条的中位数作为基线
- 与规则引擎结果偏差超过 30% 时提示人工复核

## 4. AI 辅助分析
- 输入：变更描述 + 文件 diff + 受影响模块清单
- 输出：任务拆解建议、风险点、估算区间（不给单点值）
- 要求：AI 结果仅作参考，必须由研发负责人确认后才能进入排期

## 5. 评审要求
- 高风险变更必须双人评审（研发负责人 + 测试负责人）
- 最终工时以人工确认为准，并记录置信度
- 变更完成后回填实际工时，作为后续校准数据`,
    },
    {
      title: "Q4 迭代规划与里程碑",
      slug: "q4-roadmap",
      category: "pm",
      summary: "Q4 三个迭代的目标、范围、里程碑与风险，含售后闭环与风控 V2。",
      author: "pm",
      created: -40,
      updated: -5,
      content: `# Q4 迭代规划

## 迭代一：售后与退款闭环（进行中）
- 目标：退款申请、审核、回调、原路退回全链路可用
- 里程碑：售后与退款闭环（进度 65%）
- 主要风险：支付宝退款重试策略不稳定，TC-007 目前阻塞

## 迭代二：风控规则引擎 V2（有风险）
- 目标：规则 DSL 化、灰度发布、监控大盘
- 里程碑：风控规则引擎 V2（进度 40%，标记 at_risk）
- 主要风险：规则执行器重写工作量大（CR-004 估算 11-14 人天），DSL 性能需压测

## 迭代三：大促压测与稳定性（未开始）
- 目标：双十一流量洪峰压测、限流降级预案、故障演练
- 里程碑：大促压测与稳定性
- 依赖：CR-005 限流开关方案确认

## 关键决策
1. 订单超时阈值缩短（CR-002）必须在迭代一结束前上线
2. 银联渠道（CR-003）已批准，本周进入联调
3. 风控 V2 若压测不达标，降级为「规则配置化」小版本上线`,
    },
  ];

  for (const doc of docs) {
    insertRow(db, "documents", {
      project_id: projectId,
      title: doc.title,
      slug: doc.slug,
      category: doc.category,
      content_md: doc.content,
      summary: doc.summary,
      status: "published",
      version: 1,
      author_id: authors[doc.author as keyof typeof authors],
      related_requirement_id: doc.req ? idByKey(db, "requirements", doc.req) : null,
      related_code_module_id: doc.mod ? idByKey(db, "code_modules", doc.mod) : null,
      created_at: isoAt(doc.created, 10, 0),
      updated_at: isoAt(doc.updated, 17, 30),
    });
  }
}

export function seedAuditLogs(db: DB): void {
  const users = {
    admin: userId(db, "admin@demo.dev"),
    pm: userId(db, "pm@demo.dev"),
    tech: userId(db, "tech@demo.dev"),
    test: userId(db, "test@demo.dev"),
    test2: userId(db, "test2@demo.dev"),
  };

  const logs: Array<[number, string, string, number | null, string, number, number]> = [
    [users.pm, "created", "change_request", null, "创建变更申请 CR-002：订单超时关闭时间调整", -2, 10],
    [users.tech, "updated", "change_request", null, "为 CR-002 补充影响模块：订单服务、库存服务、分库分表", -2, 16],
    [users.test, "generated", "regression_plan", null, "基于 CR-002 生成回归用例建议 3 条", -2, 17],
    [users.test2, "executed", "test_run", null, "RP-002 执行：TC-005 支付回调幂等通过", -1, 16],
    [users.pm, "updated", "requirement", null, "REQ-003 状态更新为「变更中」，版本 v4", -2, 11],
    [users.tech, "created", "change_request", null, "创建变更申请 CR-004：风控规则引擎 DSL 化", -6, 11],
    [users.admin, "approved", "change_request", null, "审批通过 CR-003：支付渠道新增银联云闪付", -18, 14],
    [users.test, "completed", "regression_plan", null, "RP-001 回归完成，通过率 67%，发现缺陷 DEF-2317", -15, 18],
    [users.tech, "updated", "code_module", null, "更新 MOD-001 订单服务：超时关闭定时任务合入主干", -20, 15],
    [users.pm, "created", "requirement", null, "创建需求 REQ-009：大促限流与降级预案（草稿）", -20, 9],
    [users.admin, "asked", "ai", null, "AI 问答：订单超时关闭现在是多少分钟？", -1, 20],
    [users.test2, "updated", "test_case", null, "更新 TC-003 步骤：补充关闭后支付拦截断言", -3, 11],
  ];

  for (const [userId, action, entityType, entityId, summary, dayOffset, hour] of logs) {
    insertRow(db, "audit_logs", {
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      summary,
      created_at: isoAt(dayOffset, hour, 0),
    });
  }
}

function userId(db: DB, email: string): number {
  const row = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number | bigint } | undefined;
  if (!row) throw new Error(`seed: 找不到用户 ${email}`);
  return Number(row.id);
}
