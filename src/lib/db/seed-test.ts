import type { DB } from "./db-types";
import { dateAt, idByKey, insertRow, isoAt } from "./seed-utils";

/** 种子数据 · Test 域：测试用例、追溯关系、回归计划、执行记录 */

interface SeedTestCase {
  key: string;
  title: string;
  reqs: string[];
  codes: string[];
  type: string;
  priority: string;
  status: string;
  automated: number;
  owner: "test" | "test2";
  precondition: string;
  steps: string;
  expected: string;
  lastResult: string;
  lastRun: number | null;
}

export function seedTestCases(db: DB): void {
  const projectId = idByKey(db, "projects", "SHOP");
  const owners = {
    test: userId(db, "test@demo.dev"),
    test2: userId(db, "test2@demo.dev"),
  };

  const cases: SeedTestCase[] = [
    {
      key: "TC-001",
      title: "正常下单全流程（购物车 → 结算 → 支付成功）",
      reqs: ["REQ-001", "REQ-002"],
      codes: ["MOD-001", "MOD-006", "MOD-010"],
      type: "functional",
      priority: "P0",
      status: "active",
      automated: 1,
      owner: "test",
      precondition: "已登录普通买家账号；购物车中有 2 件有库存商品；收货地址已配置。",
      steps: `1. 进入购物车，勾选 2 件商品点击「去结算」
2. 在结算页确认优惠、地址与金额
3. 点击「提交订单」
4. 选择微信支付并完成支付
5. 打开订单中心查看订单状态`,
      expected: `- 订单创建成功，返回订单号
- 库存按 SKU 扣减且不超卖
- 支付成功后订单状态变为「待发货」
- 订单中心可查询到该订单及支付金额`,
      lastResult: "pass",
      lastRun: -2,
    },
    {
      key: "TC-002",
      title: "库存不足时提交订单被拦截",
      reqs: ["REQ-001"],
      codes: ["MOD-001", "MOD-003"],
      type: "edge",
      priority: "P0",
      status: "active",
      automated: 1,
      owner: "test",
      precondition: "购物车商品可用库存为 1，将库存调整为 0 后提交。",
      steps: `1. 构造库存为 1 的 SKU 加入购物车
2. 结算页提交订单
3. 并发另一账号购买该 SKU 使库存归零后再次提交`,
      expected: `- 库存不足时返回明确的错误码与提示
- 不生成订单，不产生脏数据
- 无超卖，库存不为负数`,
      lastResult: "pass",
      lastRun: -2,
    },
    {
      key: "TC-003",
      title: "未支付订单 30 分钟超时自动关闭",
      reqs: ["REQ-003"],
      codes: ["MOD-001", "MOD-003"],
      type: "regression",
      priority: "P0",
      status: "active",
      automated: 1,
      owner: "test",
      precondition: "可修改订单超时阈值的测试环境；下单后不支付。",
      steps: `1. 创建订单但不支付
2. 将订单创建时间回拨 31 分钟
3. 触发定时任务扫描
4. 查询订单状态与库存`,
      expected: `- 订单状态变为「已关闭」，关闭原因为超时
- 锁定库存被释放，可售库存恢复
- 用户再次支付被拦截并提示订单已关闭`,
      lastResult: "pass",
      lastRun: -1,
    },
    {
      key: "TC-004",
      title: "订单关闭后库存释放幂等性",
      reqs: ["REQ-003", "REQ-007"],
      codes: ["MOD-003", "MOD-001"],
      type: "regression",
      priority: "P0",
      status: "active",
      automated: 0,
      owner: "test",
      precondition: "存在一笔已关闭订单，其库存已释放。",
      steps: `1. 手动重复触发订单关闭事件 3 次
2. 查询库存流水与可售库存
3. 检查库存变更日志`,
      expected: `- 只有 1 条有效库存释放流水
- 可售库存只恢复一次，不出现超卖
- 重复关闭事件被幂等拦截并记录`,
      lastResult: "fail",
      lastRun: -1,
    },
    {
      key: "TC-005",
      title: "支付回调重复通知幂等",
      reqs: ["REQ-002"],
      codes: ["MOD-002"],
      type: "integration",
      priority: "P1",
      status: "active",
      automated: 1,
      owner: "test2",
      precondition: "可重放支付回调报文；准备已支付订单。",
      steps: `1. 模拟支付成功回调通知
2. 重复发送同一通知 5 次
3. 查询订单状态、支付流水与账户余额`,
      expected: `- 订单只流转一次为已支付
- 支付流水且只有一条入账记录
- 重复回调被幂等表拦截并返回成功响应`,
      lastResult: "pass",
      lastRun: -3,
    },
    {
      key: "TC-006",
      title: "微信支付退款原路退回",
      reqs: ["REQ-004"],
      codes: ["MOD-004", "MOD-002"],
      type: "integration",
      priority: "P0",
      status: "active",
      automated: 0,
      owner: "test2",
      precondition: "存在一笔微信已支付、未发货订单。",
      steps: `1. 用户发起全额退款申请
2. 客服审核通过
3. 触发退款回调
4. 查询订单与退款单状态`,
      expected: `- 退款单状态变为「已退款」
- 订单状态变为「已退款」，金额退回原支付渠道
- 退款回调幂等，重复通知不重复退款`,
      lastResult: "pass",
      lastRun: -5,
    },
    {
      key: "TC-007",
      title: "支付宝退款失败自动重试 3 次",
      reqs: ["REQ-004"],
      codes: ["MOD-004"],
      type: "functional",
      priority: "P1",
      status: "active",
      automated: 0,
      owner: "test2",
      precondition: "模拟支付宝退款接口前 3 次返回失败。",
      steps: `1. 发起支付宝订单退款申请并审核通过
2. 观察退款重试队列
3. 第 4 次退款接口返回成功后查询结果`,
      expected: `- 前 3 次失败按退避策略自动重试
- 第 4 次成功后退款单状态正确
- 若 3 次均失败则进入人工处理队列并告警`,
      lastResult: "blocked",
      lastRun: -4,
    },
    {
      key: "TC-008",
      title: "退款审核驳回后状态回滚",
      reqs: ["REQ-004"],
      codes: ["MOD-004", "MOD-007"],
      type: "edge",
      priority: "P1",
      status: "active",
      automated: 0,
      owner: "test",
      precondition: "存在一笔已支付订单，用户已提交退款申请。",
      steps: `1. 客服在审核页驳回退款申请
2. 查看订单与退款单状态
3. 再次发起退款申请`,
      expected: `- 退款单状态变为「已驳回」并记录原因
- 订单状态回到退款前状态
- 用户可再次发起退款申请`,
      lastResult: "not_run",
      lastRun: null,
    },
    {
      key: "TC-009",
      title: "满减券与折扣券叠加计算",
      reqs: ["REQ-005"],
      codes: ["MOD-006", "MOD-001"],
      type: "functional",
      priority: "P1",
      status: "active",
      automated: 1,
      owner: "test",
      precondition: "用户持有可叠加的满减券与折扣券各一张，且均满足门槛。",
      steps: `1. 结算页同时选择两张优惠券
2. 查看优惠明细与应付金额
3. 提交订单并核对订单金额`,
      expected: `- 结算页与订单金额一致
- 优惠明细展示每张券的抵扣金额
- 前后端金额计算一致，无精度问题`,
      lastResult: "pass",
      lastRun: -6,
    },
    {
      key: "TC-010",
      title: "互斥优惠券同时使用被拒绝",
      reqs: ["REQ-005"],
      codes: ["MOD-006"],
      type: "edge",
      priority: "P1",
      status: "active",
      automated: 1,
      owner: "test",
      precondition: "准备两张配置为互斥的优惠券。",
      steps: `1. 结算页选择第一张互斥券
2. 尝试选择第二张互斥券
3. 检查页面提示与最终优惠计算`,
      expected: `- 第二张券置灰并提示互斥原因
- 最终只应用一张券的优惠
- 提交订单后服务端再次校验互斥规则`,
      lastResult: "pass",
      lastRun: -6,
    },
    {
      key: "TC-011",
      title: "高频下单触发风控拦截",
      reqs: ["REQ-006"],
      codes: ["MOD-005", "MOD-010"],
      type: "functional",
      priority: "P0",
      status: "active",
      automated: 1,
      owner: "test2",
      precondition: "风控规则：单设备 10 分钟内下单次数 > 20 触发拦截。",
      steps: `1. 使用同一设备指纹在 10 分钟内连续下单 21 次
2. 观察第 21 次下单结果
3. 查询风控命中日志`,
      expected: `- 第 21 次下单被拦截，返回风控原因
- 风控日志记录规则 ID、设备指纹与命中时间
- 被拦截订单不占用库存`,
      lastResult: "pass",
      lastRun: -3,
    },
    {
      key: "TC-012",
      title: "同设备多账号登录下单告警",
      reqs: ["REQ-006"],
      codes: ["MOD-005"],
      type: "functional",
      priority: "P1",
      status: "active",
      automated: 0,
      owner: "test2",
      precondition: "准备同一设备的 3 个买家账号。",
      steps: `1. 同一设备依次登录 3 个账号并各下一单
2. 查询设备风险视图与告警记录
3. 查看账号是否被标记为可疑`,
      expected: `- 设备风险视图正确聚合 3 个账号
- 触发「同设备多账号」告警
- 告警可在风控后台查看并支持人工处置`,
      lastResult: "fail",
      lastRun: -3,
    },
    {
      key: "TC-013",
      title: "订单状态机非法流转拦截",
      reqs: ["REQ-007"],
      codes: ["MOD-001"],
      type: "edge",
      priority: "P2",
      status: "active",
      automated: 1,
      owner: "test",
      precondition: "存在待支付订单。",
      steps: `1. 对「待支付」订单直接调用发货接口
2. 对「已完成」订单调用取消接口
3. 查询订单状态与状态流水`,
      expected: `- 非法流转返回明确错误码
- 订单状态保持不变
- 非法流转尝试被记录到状态流水日志`,
      lastResult: "pass",
      lastRun: -7,
    },
    {
      key: "TC-014",
      title: "订单详情页状态时间轴展示正确",
      reqs: ["REQ-007"],
      codes: ["MOD-007"],
      type: "functional",
      priority: "P2",
      status: "active",
      automated: 0,
      owner: "test2",
      precondition: "准备待支付、已支付、退款中三种状态的订单各一笔。",
      steps: `1. 分别打开三笔订单的详情页
2. 检查状态时间轴的节点、时间与文案`,
      expected: `- 时间轴节点与订单状态流水一致
- 当前状态高亮，历史节点按时间正序
- 退款中订单展示退款进度节点`,
      lastResult: "pass",
      lastRun: -7,
    },
    {
      key: "TC-015",
      title: "收货地址新增 / 编辑 / 删除",
      reqs: ["REQ-008"],
      codes: ["MOD-007"],
      type: "functional",
      priority: "P3",
      status: "deprecated",
      automated: 0,
      owner: "test",
      precondition: "已登录买家账号。",
      steps: `1. 新增一条收货地址并设为默认
2. 编辑地址信息
3. 删除地址`,
      expected: `- 地址增删改均成功
- 默认地址唯一
- 已废弃：地址能力已迁移至用户中心`,
      lastResult: "pass",
      lastRun: -40,
    },
    {
      key: "TC-016",
      title: "结算页优惠券选择交互",
      reqs: ["REQ-005"],
      codes: ["MOD-006"],
      type: "functional",
      priority: "P2",
      status: "active",
      automated: 0,
      owner: "test",
      precondition: "账户中有多张可用券与不可用券。",
      steps: `1. 打开结算页优惠券选择弹层
2. 切换不同优惠券
3. 查看金额与优惠明细即时刷新`,
      expected: `- 优惠券按可用/不可用分组展示
- 切换后金额即时刷新且无抖动
- 选择状态在提交订单后保持`,
      lastResult: "pass",
      lastRun: -9,
    },
    {
      key: "TC-017",
      title: "支付渠道故障自动降级切换",
      reqs: ["REQ-002"],
      codes: ["MOD-002", "MOD-010"],
      type: "functional",
      priority: "P0",
      status: "active",
      automated: 0,
      owner: "test2",
      precondition: "支付网关配置为主渠道微信、备用渠道支付宝。",
      steps: `1. 模拟微信支付接口超时故障
2. 用户发起支付
3. 观察渠道切换与支付结果`,
      expected: `- 自动切换至备用渠道并完成支付
- 切换过程用户无感知，成功率不低于 95%
- 故障渠道进入熔断状态并告警`,
      lastResult: "blocked",
      lastRun: -2,
    },
    {
      key: "TC-018",
      title: "订单列表分页查询性能",
      reqs: ["REQ-001"],
      codes: ["MOD-001", "MOD-008"],
      type: "performance",
      priority: "P2",
      status: "active",
      automated: 1,
      owner: "test",
      precondition: "订单表单分片数据量 200 万。",
      steps: `1. 压测订单列表接口 100 QPS 持续 5 分钟
2. 记录 P95 / P99 响应时间
3. 检查慢查询日志`,
      expected: `- P95 < 200ms，P99 < 500ms
- 无慢查询告警
- 分页查询走索引且不扫全表`,
      lastResult: "pass",
      lastRun: -10,
    },
    {
      key: "TC-019",
      title: "大促下单接口限流与降级",
      reqs: ["REQ-009"],
      codes: ["MOD-010", "MOD-009"],
      type: "performance",
      priority: "P1",
      status: "draft",
      automated: 0,
      owner: "test",
      precondition: "网关开启下单接口限流配置 500 QPS。",
      steps: `1. 压测流量提升至 800 QPS
2. 观察限流生效与降级策略
3. 恢复流量后检查系统状态`,
      expected: `- 超出阈值的请求返回友好提示
- 非核心接口按预案降级
- 流量恢复后系统自动恢复`,
      lastResult: "not_run",
      lastRun: null,
    },
    {
      key: "TC-020",
      title: "网关鉴权与限流",
      reqs: ["REQ-002"],
      codes: ["MOD-010", "MOD-009"],
      type: "integration",
      priority: "P1",
      status: "active",
      automated: 1,
      owner: "test2",
      precondition: "准备无 token、过期 token、正常 token 三种请求。",
      steps: `1. 分别请求受保护接口
2. 检查鉴权失败响应
3. 高频请求验证限流`,
      expected: `- 无效 token 返回 401 且不泄露内部信息
- 限流阈值生效并返回 429
- 正常请求不被误伤`,
      lastResult: "pass",
      lastRun: -11,
    },
  ];

  for (const tc of cases) {
    const testCaseId = insertRow(db, "test_cases", {
      project_id: projectId,
      key: tc.key,
      title: tc.title,
      precondition_md: tc.precondition,
      steps_md: tc.steps,
      expected_md: tc.expected,
      type: tc.type,
      priority: tc.priority,
      status: tc.status,
      automated: tc.automated,
      owner_id: owners[tc.owner],
      last_result: tc.lastResult,
      last_run_at: tc.lastRun === null ? null : isoAt(tc.lastRun, 15, 30),
      created_at: isoAt(-120, 10, 0),
      updated_at: tc.lastRun === null ? isoAt(-20, 10, 0) : isoAt(tc.lastRun, 16, 0),
    });

    for (const req of tc.reqs) {
      insertRow(db, "test_case_requirement_links", {
        test_case_id: testCaseId,
        requirement_id: idByKey(db, "requirements", req),
      });
    }
    for (const code of tc.codes) {
      insertRow(db, "test_case_code_links", {
        test_case_id: testCaseId,
        code_module_id: idByKey(db, "code_modules", code),
      });
    }
  }
}

export function seedRegressionPlans(db: DB): void {
  const projectId = idByKey(db, "projects", "SHOP");
  const su = userId(db, "test@demo.dev");
  const he = userId(db, "test2@demo.dev");

  const plans: Array<{
    key: string;
    title: string;
    change: string | null;
    status: string;
    scope: string;
    createdBy: number;
    created: number;
    started: number | null;
    completed: number | null;
    cases: Array<{ tc: string; score: number; reason: string; required: number }>;
  }> = [
    {
      key: "RP-001",
      title: "CR-001 订单超时关闭与库存释放回归",
      change: "CR-001",
      status: "completed",
      scope: "覆盖订单关闭、库存释放、支付回调拦截与状态机流转",
      createdBy: su,
      created: -18,
      started: -17,
      completed: -15,
      cases: [
        { tc: "TC-003", score: 98, reason: "变更直接修改超时关闭规则", required: 1 },
        { tc: "TC-004", score: 95, reason: "库存释放幂等为本次改造重点", required: 1 },
        { tc: "TC-005", score: 80, reason: "支付回调需识别已关闭订单", required: 1 },
        { tc: "TC-013", score: 85, reason: "状态机新增已关闭状态", required: 1 },
        { tc: "TC-014", score: 90, reason: "订单详情需展示关闭原因", required: 1 },
        { tc: "TC-018", score: 70, reason: "分片任务参数变化，性能基线复测", required: 0 },
      ],
    },
    {
      key: "RP-002",
      title: "CR-003 银联云闪付渠道回归",
      change: "CR-003",
      status: "running",
      scope: "覆盖支付回调、退款、渠道降级与主流程支付",
      createdBy: he,
      created: -2,
      started: -1,
      completed: null,
      cases: [
        { tc: "TC-005", score: 90, reason: "新增银联回调验签，幂等用例需覆盖", required: 1 },
        { tc: "TC-006", score: 85, reason: "退款链路依赖支付渠道", required: 1 },
        { tc: "TC-007", score: 88, reason: "退款失败重试逻辑受渠道影响", required: 0 },
        { tc: "TC-017", score: 95, reason: "渠道降级策略新增银联优先级", required: 1 },
        { tc: "TC-001", score: 92, reason: "收银台新增渠道入口，主流程必测", required: 1 },
      ],
    },
    {
      key: "RP-003",
      title: "大促前全链路基线回归",
      change: null,
      status: "planned",
      scope: "大促发布前对交易核心链路做全量基线回归",
      createdBy: su,
      created: -1,
      started: null,
      completed: null,
      cases: [
        { tc: "TC-001", score: 100, reason: "核心主流程", required: 1 },
        { tc: "TC-002", score: 95, reason: "库存边界", required: 1 },
        { tc: "TC-003", score: 95, reason: "订单关闭", required: 1 },
        { tc: "TC-005", score: 90, reason: "支付回调幂等", required: 1 },
        { tc: "TC-006", score: 85, reason: "退款链路", required: 1 },
        { tc: "TC-009", score: 80, reason: "优惠计算", required: 1 },
        { tc: "TC-011", score: 90, reason: "风控拦截", required: 1 },
        { tc: "TC-017", score: 85, reason: "渠道降级", required: 1 },
        { tc: "TC-018", score: 70, reason: "订单查询性能", required: 0 },
        { tc: "TC-020", score: 75, reason: "网关鉴权限流", required: 1 },
      ],
    },
  ];

  const planIds: Record<string, number> = {};

  for (const plan of plans) {
    const planId = insertRow(db, "regression_plans", {
      project_id: projectId,
      change_request_id: plan.change ? idByKey(db, "change_requests", plan.change) : null,
      key: plan.key,
      title: plan.title,
      status: plan.status,
      scope_desc: plan.scope,
      created_by: plan.createdBy,
      created_at: isoAt(plan.created, 10, 0),
      started_at: plan.started === null ? null : isoAt(plan.started, 11, 0),
      completed_at: plan.completed === null ? null : isoAt(plan.completed, 18, 0),
    });
    planIds[plan.key] = planId;

    for (const item of plan.cases) {
      insertRow(db, "regression_plan_cases", {
        plan_id: planId,
        test_case_id: idByKey(db, "test_cases", item.tc),
        recommendation_score: item.score,
        reason: item.reason,
        required: item.required,
      });
    }
  }

  // RP-001 已完成：5 条执行记录（4 通过 / 1 失败 / 1 跳过）
  const rp1Runs: Array<[string, string, string, number, string, string]> = [
    ["TC-003", "pass", "苏晴", -15, "关闭逻辑与库存释放均符合预期", ""],
    ["TC-004", "fail", "苏晴", -15, "重复触发关闭事件时库存释放了 2 次，已提单 DEF-2317", "DEF-2317"],
    ["TC-005", "pass", "何雨", -15, "重复回调被幂等表拦截", ""],
    ["TC-013", "pass", "苏晴", -15, "非法流转全部被拦截", ""],
    ["TC-014", "pass", "何雨", -15, "时间轴展示正确", ""],
    ["TC-018", "skipped", "苏晴", -15, "本环境无 200 万数据量，延期到性能环境执行", ""],
  ];
  for (const [tc, result, executor, when, notes, defect] of rp1Runs) {
    insertRow(db, "test_runs", {
      plan_id: planIds["RP-001"],
      test_case_id: idByKey(db, "test_cases", tc),
      result,
      executor_id: executor === "苏晴" ? su : he,
      executed_at: isoAt(when, 14, 0),
      notes,
      defect_ref: defect,
    });
  }

  // RP-002 执行中：3 条已执行 + 2 条未执行
  const rp2Runs: Array<[string, string, string, number, string]> = [
    ["TC-005", "pass", "何雨", -1, "银联回调验签通过，幂等正常"],
    ["TC-007", "pass", "何雨", -1, "重试策略符合预期"],
    ["TC-001", "pass", "何雨", 0, "主流程含银联入口通过"],
    ["TC-006", "not_run", "何雨", 0, "待执行"],
    ["TC-017", "not_run", "何雨", 0, "待执行"],
  ];
  for (const [tc, result, executor, when, notes] of rp2Runs) {
    insertRow(db, "test_runs", {
      plan_id: planIds["RP-002"],
      test_case_id: idByKey(db, "test_cases", tc),
      result,
      executor_id: executor === "何雨" ? he : su,
      executed_at: result === "not_run" ? null : isoAt(when, 16, 0),
      notes,
      defect_ref: "",
    });
  }

  // 回填用例最近执行结果（保持一致）
  db.prepare(
    `UPDATE test_cases SET last_result = 'fail', last_run_at = ?
     WHERE key IN ('TC-004','TC-012') AND last_run_at IS NULL`,
  ).run(isoAt(-1, 16, 0));

  void dateAt;
}

function userId(db: DB, email: string): number {
  const row = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number | bigint } | undefined;
  if (!row) throw new Error(`seed: 找不到用户 ${email}`);
  return Number(row.id);
}
