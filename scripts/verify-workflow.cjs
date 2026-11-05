/**
 * Exercise real actions, queries and rendering against a disposable database.
 * Only Next request context, navigation and cache invalidation are substituted;
 * this does not replace a browser smoke test of Next's HTTP action transport.
 * Run: pnpm exec node scripts/verify-workflow.cjs
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "poc-workflow-verify-"));
process.env.DB_PATH = path.join(directory, "test.db");
// Verification must remain offline even if the shell has a configured provider.
process.env.DEEPSEEK_API_KEY = "";
process.env.OPENAI_API_KEY = "";
let token = null;
let locale = "en";
let checks = 0;
const originalLoad = Module._load;

class Navigation extends Error {
  constructor(target) { super(target); this.target = target; }
}

Module._load = function (id, parent, isMain) {
  if (id.endsWith(".css")) return {};
  if (id === "next/cache") return { revalidatePath() {} };
  if (id === "next/headers") return { cookies: async () => ({
    get: name => name === "traceflow_locale" ? { value: locale } : token ? { value: token } : undefined,
    set(name, value) { if (name === "traceflow_locale") locale = value; else token = value; },
    delete(name) { if (name !== "traceflow_locale") token = null; },
  }) };
  if (id === "next/navigation") return {
    redirect(target) { throw new Navigation(target); },
    notFound() { throw new Navigation("NOT_FOUND"); },
    usePathname() { return "/dashboard"; },
  };
  return originalLoad.call(this, id, parent, isMain);
};
require("tsx/cjs");

const db = require("../src/lib/db/client.ts");
const session = require("../src/lib/session.ts");
const requirements = require("../src/app/(app)/requirements/actions.ts");
const tasks = require("../src/app/(app)/tasks/actions.ts");
const modules = require("../src/app/(app)/code/actions.ts");
const testCases = require("../src/app/(app)/tests/actions.ts");
const changes = require("../src/app/(app)/changes/actions.ts");
const regression = require("../src/app/(app)/regression/actions.ts");
const docs = require("../src/app/(app)/docs/actions.ts");
const users = require("../src/app/(app)/admin/users/actions.ts");

function check(condition, message) {
  assert.ok(condition, message);
  checks++;
}

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;
    for (const entry of Array.isArray(value) ? value : [value]) data.append(key, String(entry));
  }
  return data;
}

async function as(role) {
  const user = db.get("SELECT id,email,name,role FROM users WHERE role=? AND active=1 ORDER BY id LIMIT 1", role);
  token = await session.signSession({ ...user, sub: String(user.id) });
  return user;
}

async function action(fn, values, outcome = "saved") {
  let target;
  try { await fn(form(values)); } catch (error) {
    if (!(error instanceof Navigation)) throw error;
    target = error.target;
  }
  check(Boolean(target), `${fn.name} must redirect`);
  const result = new URL(target, "http://local.test");
  if (outcome === "saved" || outcome === "error") {
    check(result.searchParams.has(outcome), `${fn.name}: expected ${outcome}, received ${target}`);
  } else check(target.startsWith(outcome), `${fn.name}: expected redirect to ${outcome}, received ${target}`);
  return result;
}

async function main() {
  db.getDb();
  await as("pm");
  await action(requirements.createRequirementAction, { title: "Verification requirement", priority: "P1", description_md: "Verify a complete release workflow." });
  const req = db.get("SELECT * FROM requirements ORDER BY id DESC LIMIT 1");
  await action(requirements.linkCodeModuleAction, { requirement_id: req.id, code_module_id: 1 });
  await action(requirements.linkTestCaseAction, { requirement_id: req.id, test_case_id: 1 });
  await action(tasks.createTaskAction, { title: "Verification task", dimension: "pm", requirement_id: req.id, estimate_days: 2 });
  const task = db.get("SELECT * FROM tasks ORDER BY id DESC LIMIT 1");
  check(task.requirement_id === req.id, "Task links to the new requirement");
  await as("tech");
  await action(tasks.updateTaskStatusAction, { task_id: task.id, status: "done" }, "error");
  check(db.get("SELECT status FROM tasks WHERE id=?", task.id).status === "todo", "Cross-dimension task updates are denied");
  const moduleValues = { name: "Verification module", path: "src/order/verification.ts", language: "TypeScript", layer: "backend", risk: "high", loc: 100, owner_id: 3 };
  await action(modules.saveModuleAction, moduleValues);
  const module = db.get("SELECT * FROM code_modules ORDER BY id DESC LIMIT 1");
  await action(modules.saveModuleAction, { ...moduleValues, id: "invalid" }, "error");
  await action(modules.saveModuleAction, { ...moduleValues, id: module.id, owner_id: "invalid" }, "error");
  check(db.get("SELECT owner_id FROM code_modules WHERE id=?", module.id).owner_id === 3, "Malformed owner updates preserve module ownership");
  await action(modules.saveModuleAction, { ...moduleValues, id: module.id, loc: 120 });
  check(db.get("SELECT loc FROM code_modules WHERE id=?", module.id).loc === 120, "Module edits persist");
  await as("test");
  const testValues = { title: "Verification test", type: "functional", priority: "P1", status: "active", steps_md: "Submit an order.", expected_md: "Order is accepted.", requirement_ids: [req.id], code_module_ids: [1] };
  await action(testCases.saveTestCaseAction, testValues);
  const testCase = db.get("SELECT * FROM test_cases ORDER BY id DESC LIMIT 1");
  check(db.get("SELECT id FROM test_case_requirement_links WHERE test_case_id=? AND requirement_id=?", testCase.id, req.id), "Test creation persists requirement traceability");
  await action(testCases.saveTestCaseAction, { ...testValues, id: testCase.id, title: "Invalid edit", code_module_ids: [999999] }, "error");
  check(db.get("SELECT title FROM test_cases WHERE id=?", testCase.id).title === testValues.title, "Invalid test relations do not partially overwrite the case");
  await as("tech");

  await action(changes.createChangeAction, {
    title: "Verification change", requirement_id: req.id, description_md: "Update order timeout rules.",
    reason: "Verify release traceability", change_type: "func_change", risk_level: "high", affected_files: 3, added_lines: 100, removed_lines: 20,
  });
  const change = db.get("SELECT * FROM change_requests ORDER BY id DESC LIMIT 1");
  await action(changes.transitionChangeAction, { id: change.id, status: "approved", final_effort_days: 3 }, "error");
  await action(changes.analyzeChangeAction, { id: change.id });
  check(db.get("SELECT COUNT(*) AS n FROM change_code_impacts WHERE change_request_id=?", change.id).n > 0, "Analysis persists impacted modules");
  check(db.get("SELECT COUNT(*) AS n FROM effort_estimates WHERE change_request_id=? AND source='rule'", change.id).n > 0, "Analysis persists rule effort");
  await action(changes.estimateChangeAction, { id: change.id, source: "manual", days: 3, notes: "Confirmed after reviewing affected modules." });
  await action(changes.estimateChangeAction, { id: change.id, source: "llm" });
  check(!db.get("SELECT id FROM effort_estimates WHERE change_request_id=? AND source='llm'", change.id), "Missing provider saves a rule fallback without pretending it is AI");
  await action(changes.generateSuggestionsAction, { id: change.id });
  await action(changes.transitionChangeAction, { id: change.id, status: "pending_approval" });
  await action(changes.analyzeChangeAction, { id: change.id }, "error");
  await action(changes.transitionChangeAction, { id: change.id, status: "approved", final_effort_days: 3 }, "error");
  await as("pm");
  await action(changes.transitionChangeAction, { id: change.id, status: "approved", final_effort_days: 3 });
  check(db.get("SELECT status FROM requirements WHERE id=?", req.id).status === "changed", "Approval marks the requirement as changed");
  await as("tech");
  await action(changes.transitionChangeAction, { id: change.id, status: "implemented" }, "error");

  await as("test");
  for (const suggestion of db.all("SELECT id FROM test_change_suggestions WHERE change_request_id=?", change.id)) {
    await action(changes.resolveSuggestionAction, { id: change.id, suggestion_id: suggestion.id, resolved: 1 });
  }
  const recommended = require("../src/lib/regression.ts").recommendCasesForChange(change.id);
  check(recommended.length > 0, "Change produces regression recommendations");
  await action(regression.createPlanAction, { title: "Verification regression", change_request_id: change.id, scope_desc: "Affected order behavior", case_ids: recommended.map(item => item.testCase.id) });
  const plan = db.get("SELECT * FROM regression_plans ORDER BY id DESC LIMIT 1");
  const cases = db.all("SELECT * FROM regression_plan_cases WHERE plan_id=?", plan.id);
  check(cases.length > 0, "Plan persists selected cases");
  await action(regression.updatePlanStatusAction, { plan_id: plan.id, status: "complete" }, "error");
  await action(regression.updatePlanStatusAction, { plan_id: plan.id, status: "start" });
  await action(regression.updatePlanStatusAction, { plan_id: plan.id, status: "complete" }, "error");
  const unrelated = db.get("SELECT id FROM test_cases WHERE id NOT IN (SELECT test_case_id FROM regression_plan_cases WHERE plan_id=?) LIMIT 1", plan.id);
  if (unrelated) await action(regression.recordResultAction, { plan_id: plan.id, test_case_id: unrelated.id, result: "pass" }, "error");
  await action(regression.recordResultAction, { plan_id: plan.id, test_case_id: cases[0].test_case_id, result: "fail", defect_ref: "DEF-VERIFY" });
  await action(regression.recordResultAction, { plan_id: plan.id, test_case_id: cases[0].test_case_id, result: "pass", notes: "Passed after fixing the defect." });
  for (const item of cases.slice(1)) await action(regression.recordResultAction, { plan_id: plan.id, test_case_id: item.test_case_id, result: "pass" });
  check(db.get("SELECT COUNT(*) AS n FROM test_runs WHERE plan_id=? AND test_case_id=?", plan.id, cases[0].test_case_id).n === 2, "Retests preserve execution history");
  const stats = require("../src/lib/queries/regression.ts").getPlanStats(plan.id);
  check(stats.passed === cases.length, `Latest result drives pass count: ${JSON.stringify(stats)}`);
  await action(regression.updatePlanStatusAction, { plan_id: plan.id, status: "complete" });
  await action(regression.recordResultAction, { plan_id: plan.id, test_case_id: cases[0].test_case_id, result: "fail" }, "error");
  // A newer regression must supersede a prior success rather than allowing stale release evidence.
  await action(regression.createPlanAction, { title: "Verification follow-up", change_request_id: change.id, case_ids: recommended.map(item => item.testCase.id) });
  const followUp = db.get("SELECT * FROM regression_plans ORDER BY id DESC LIMIT 1");
  await as("tech");
  await action(changes.transitionChangeAction, { id: change.id, status: "implemented" }, "error");
  await as("test");
  await action(regression.updatePlanStatusAction, { plan_id: followUp.id, status: "start" });
  for (const item of db.all("SELECT * FROM regression_plan_cases WHERE plan_id=?", followUp.id)) {
    await action(regression.recordResultAction, { plan_id: followUp.id, test_case_id: item.test_case_id, result: "fail", defect_ref: "DEF-FOLLOW-UP" });
  }
  await action(regression.updatePlanStatusAction, { plan_id: followUp.id, status: "complete" });
  await as("tech");
  await action(changes.transitionChangeAction, { id: change.id, status: "implemented" }, "error");
  await as("test");
  await action(regression.createPlanAction, { title: "Verification final regression", change_request_id: change.id, case_ids: recommended.map(item => item.testCase.id) });
  const finalPlan = db.get("SELECT * FROM regression_plans ORDER BY id DESC LIMIT 1");
  await action(regression.updatePlanStatusAction, { plan_id: finalPlan.id, status: "start" });
  for (const item of db.all("SELECT * FROM regression_plan_cases WHERE plan_id=?", finalPlan.id)) {
    await action(regression.recordResultAction, { plan_id: finalPlan.id, test_case_id: item.test_case_id, result: "pass" });
  }
  await action(regression.updatePlanStatusAction, { plan_id: finalPlan.id, status: "complete" });
  await as("tech");
  await action(changes.transitionChangeAction, { id: change.id, status: "implemented" });
  check(db.get("SELECT status FROM change_requests WHERE id=?", change.id).status === "implemented", "Change reaches implemented through a passing regression");
  check(db.get("SELECT status FROM requirements WHERE id=?", req.id).status === "active", "Completed change returns its requirement to active");

  await as("pm");
  const docValues = { title: "Verification knowledge", slug: "verification-knowledge", category: "knowledge", status: "published", summary: "Workflow verification", content_md: "# Verified workflow\nOrder timeout validation.", related_requirement_id: req.id, related_code_module_id: 1 };
  await action(docs.saveDocumentAction, docValues);
  await action(docs.saveDocumentAction, docValues, "error");
  await action(docs.saveDocumentAction, { ...docValues, original_slug: docValues.slug, version: 1, content_md: "# Updated workflow\nVerified order timeout." });
  await action(docs.saveDocumentAction, { ...docValues, original_slug: docValues.slug, version: 1 }, "error");
  await action(docs.saveDocumentAction, { ...docValues, original_slug: docValues.slug, version: 2, related_requirement_id: "invalid" }, "error");
  check(db.get("SELECT version FROM documents WHERE slug=?", docValues.slug).version === 2, "Stale document writes are rejected");
  check(db.get("SELECT related_requirement_id FROM documents WHERE slug=?", docValues.slug).related_requirement_id === req.id, "Malformed relation updates preserve the existing link");
  const exportRoute = require("../src/app/api/docs/[slug]/export/route.ts");
  const exported = await exportRoute.GET(new Request("http://local.test"), { params: Promise.resolve({ slug: docValues.slug }) });
  check(exported.status === 200 && (await exported.text()).includes("Updated workflow"), "Markdown export returns current content");
  const askRoute = require("../src/app/api/ask/route.ts");
  const asked = await askRoute.POST(new Request("http://local.test/api/ask", { method: "POST", body: JSON.stringify({ question: "订单超时关闭" }) }));
  const answer = await asked.json();
  check(asked.status === 200 && answer.mode === "fallback" && answer.citations.length > 0, "Question answering works offline with citations");
  const invalidAsk = await askRoute.POST(new Request("http://local.test/api/ask", { method: "POST", body: JSON.stringify({ question: "" }) }));
  check(invalidAsk.status === 400, "Question validation rejects empty input");
  await action(users.updateUserAction, { id: 3, role: "admin", active: 1 }, "/dashboard");
  await as("admin");
  await action(users.updateUserAction, { id: 1, role: "pm", active: 1 }, "error");
  await action(users.updateUserAction, { id: 1, role: "admin" }, "error");
  await action(users.updateUserAction, { id: 4, role: "tech" });
  const disabled = db.get("SELECT id,email,name,role FROM users WHERE id=4");
  token = await session.signSession({ ...disabled, sub: String(disabled.id) });
  check(await require("../src/lib/auth.ts").getCurrentUser() === null, "Disabled users lose access even with a signed session");
  token = null;
  check((await askRoute.POST(new Request("http://local.test/api/ask", { method: "POST", body: "{}" }))).status === 401, "Question endpoint rejects missing sessions");
  check((await exportRoute.GET(new Request("http://local.test"), { params: Promise.resolve({ slug: docValues.slug }) })).status === 401, "Document export rejects missing sessions");
  await as("admin");
  const React = require("react");
  const { I18nProvider } = require("../src/components/i18n/provider.tsx");
  const { renderToStaticMarkup } = require("react-dom/server");
  // tsx runs these modules outside Next's compiler; provide its usual JSX binding.
  global.React = React;
  const pages = [
    ["dashboard"], ["requirements"], ["requirements/[id]", { id: "3" }],
    ["tasks"], ["tasks/[id]", { id: "3" }], ["code"], ["code/[id]", { id: "1" }],
    ["changes"], ["changes/[id]", { id: "2" }], ["changes/[id]", { id: "4" }],
    ["tests"], ["tests/[id]", { id: "3" }], ["regression"],
    ["regression/new"], ["regression/new", {}, { change: String(change.id) }],
    ["regression/[id]", { id: "1" }], ["regression/[id]", { id: "2" }],
    ["regression/[id]", { id: String(plan.id) }], ["docs"], ["docs", {}, { category: "toString" }],
    ["docs/[slug]", { slug: docValues.slug }], ["docs/new"],
    ["docs/[slug]/edit", { slug: docValues.slug }], ["ask"], ["admin/users"], ["admin/audit"],
  ];
  const interfaceHeadings = { dashboard: "Project overview", requirements: "Requirements", tasks: "Tasks", code: "Code modules", changes: "Change center", tests: "Test cases", regression: "Regression plans", "regression/new": "Create regression plan", docs: "Knowledge documents", "docs/new": "New document", ask: "Knowledge Q&A", "admin/users": "User management", "admin/audit": "Audit log" };
  const { createTranslator } = require("../src/lib/i18n/index.ts");
  const dictionaries = ["common", "pm", "tech", "test", "kb"].map(name => Object.values(require(`../src/lib/i18n/messages/${name}.ts`))[0]);
  const catalog = Object.assign({}, ...dictionaries);
  for (const [english, chinese] of Object.entries(catalog)) {
    const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort().join(",");
    check(placeholders(english) === placeholders(chinese), `Translation placeholders match: ${english}`);
  }
  const zh = createTranslator("zh-CN");
  const en = createTranslator("en");
  check(en("草稿") === "Draft", "Existing status labels have English translations");
  const translatedValidation = zh("Required field: Title.");
  check(translatedValidation.includes("请填写"), "Dynamic validation messages translate into Chinese");
  check(en(translatedValidation).startsWith("Required field:"), "Existing feedback changes back to English when the locale changes");
  check(en("Unknown {constructor}") === "Unknown {constructor}", "Unknown placeholders cannot resolve object prototype members");
  const { formatDays } = require("../src/lib/utils.ts");
  check(formatDays(2, "en").includes("person-days") && formatDays(2, "zh-CN").includes("人天"), "Effort units follow the selected locale");
  for (const language of ["en", "zh-CN"]) {
   locale = language;
   const t = createTranslator(locale);
   for (const [route, params = {}, searchParams = {}] of pages) {
    const page = require(`../src/app/(app)/${route}/page.tsx`).default;
    const element = await page({ params: Promise.resolve(params), searchParams: Promise.resolve(searchParams) });
    const html = renderToStaticMarkup(React.createElement(I18nProvider, { locale }, element));
    check(html.includes("<h1"), `${route} renders a page heading`);
    check(!html.includes("undefined"), `${route} does not render undefined data`);
    if (interfaceHeadings[route]) {
      const heading = t(interfaceHeadings[route]).replaceAll("&", "&amp;");
      check(html.includes(heading), `${route} renders its ${locale} heading`);
    }
    for (const match of html.matchAll(/href="(\/[^"]*)"/g)) {
      const pathname = new URL(match[1].replaceAll("&amp;", "&"), "http://local.test").pathname;
      const knownRoute = /^(?:\/|\/login|\/dashboard|\/requirements(?:\/\d+)?|\/tasks(?:\/\d+)?|\/code(?:\/\d+)?|\/changes(?:\/\d+)?|\/tests(?:\/\d+)?|\/regression(?:\/(?:\d+|new))?|\/docs(?:\/[a-z0-9-]+(?:\/edit)?)?|\/ask|\/admin\/(?:users|audit)|\/api\/docs\/[a-z0-9-]+\/export)$/;
      check(knownRoute.test(pathname), `${route} links to an implemented route: ${pathname}`);
    }
   }
   const root = require("../src/app/layout.tsx");
   const metadata = await root.generateMetadata();
   check(metadata.title.default.includes("TraceFlow") && metadata.title.default.includes(t("Development Lifecycle Traceability Platform")), `${locale} metadata uses the selected brand and locale`);
   const documentHtml = renderToStaticMarkup(await root.default({ children: React.createElement("p", null, "Business content stays unchanged") }));
   check(documentHtml.includes(`lang="${locale}"`), `Root document declares ${locale}`);
   const sidebar = require("../src/components/layout/sidebar.tsx").Sidebar;
   const viewer = { id: 1, name: "Demo user", role: "admin", title: "Business title", avatar_color: "indigo" };
   const sidebarHtml = renderToStaticMarkup(React.createElement(I18nProvider, { locale }, React.createElement(sidebar, { viewer })));
   check(sidebarHtml.includes("TraceFlow") && sidebarHtml.includes(t("Development Lifecycle Traceability Platform")), `${locale} sidebar uses the new brand`);
   check(!sidebarHtml.includes("星云项目管理"), "Sidebar has no obsolete product name");
   check(sidebarHtml.includes("星云电商交易平台"), "The sample business project keeps its original name");
   token = null;
   const loginPage = require("../src/app/login/page.tsx").default;
   const loginHtml = renderToStaticMarkup(React.createElement(I18nProvider, { locale }, await loginPage({ searchParams: Promise.resolve({}) })));
   check(loginHtml.includes("TraceFlow") && loginHtml.includes('name="locale"'), `${locale} login shows the brand and language selector`);
   await as("admin");
   const localeAnswer = await (await askRoute.POST(new Request("http://local.test/api/ask", { method: "POST", body: JSON.stringify({ question: "订单超时关闭" }) }))).json();
   check(localeAnswer.answer.includes(t("Local search mode")), `${locale} Q&A fallback uses the interface language`);
   const badDoc = await action(docs.saveDocumentAction, { ...docValues, original_slug: docValues.slug, version: 2, related_requirement_id: "invalid" }, "error");
   check(badDoc.searchParams.get("error") === t("Invalid requirement ID."), `${locale} validation feedback is localized`);
  }
  const localeAction = require("../src/app/locale-actions.ts").setLocaleAction;
  const sessionBeforeSwitch = token;
  await localeAction(form({ locale: "en" }));
  check(locale === "en" && token === sessionBeforeSwitch, "Language changes preserve the authenticated session");
  await assert.rejects(() => localeAction(form({ locale: "fr" })), /Unsupported locale/);
  checks++;
  check(locale === "en", "Unsupported locales do not overwrite the preference");
  locale = "invalid";
  check((await require("../src/lib/i18n/server.ts").getI18n()).locale === "zh-CN", "Invalid preference falls back to Simplified Chinese");
  locale = "en";
  await as("pm");
  for (const route of ["admin/users", "admin/audit"]) {
    await assert.rejects(() => require(`../src/app/(app)/${route}/page.tsx`).default({ searchParams: Promise.resolve({}) }), error => error instanceof Navigation && error.target.startsWith("/dashboard"));
    checks++;
  }
  await assert.rejects(() => require("../src/app/(app)/docs/[slug]/page.tsx").default({ params: Promise.resolve({ slug: "nonexistent-document" }), searchParams: Promise.resolve({}) }), error => error instanceof Navigation && error.target === "NOT_FOUND");
  checks++;
  check(db.all("PRAGMA foreign_key_check").length === 0, "Workflow preserves foreign keys");
  check(db.get("SELECT COUNT(*) AS n FROM audit_logs").n > 30, "Workflow writes audit records");
  console.log(`PASS: ${checks} checks against a disposable SQLite database.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  db.closeDb();
  Module._load = originalLoad;
  fs.rmSync(directory, { recursive: true, force: true });
});
