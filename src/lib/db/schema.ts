/**
 * SQLite 数据库结构（node:sqlite）
 *
 * 设计原则：
 * - 结构化实体与追溯关系进库；文档正文以 Markdown 文本存在 documents.content_md
 * - 外键开启，依赖关系用 ON DELETE CASCADE / SET NULL 显式声明
 * - 枚举值用 CHECK 约束兜底
 * - 时间统一存 ISO 字符串（UTC）
 */
export const SCHEMA_SQL = /* sql */ `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','pm','tech','test')),
  title         TEXT NOT NULL DEFAULT '',
  avatar_color  TEXT NOT NULL DEFAULT 'indigo',
  password_hash TEXT NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'active',
  start_date  TEXT,
  target_date TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  target_date TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'planned'
              CHECK (status IN ('planned','in_progress','done','at_risk')),
  progress    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS requirements (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key            TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  description_md TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','active','changed','deprecated')),
  priority       TEXT NOT NULL DEFAULT 'P2'
                 CHECK (priority IN ('P0','P1','P2','P3')),
  owner_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  source         TEXT NOT NULL DEFAULT '',
  version        INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requirement_id INTEGER REFERENCES requirements(id) ON DELETE SET NULL,
  key            TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  description_md TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'todo'
                 CHECK (status IN ('backlog','todo','in_progress','review','done','blocked')),
  dimension      TEXT NOT NULL DEFAULT 'tech'
                 CHECK (dimension IN ('pm','tech','test')),
  assignee_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  estimate_days  REAL NOT NULL DEFAULT 0,
  actual_days    REAL NOT NULL DEFAULT 0,
  start_date     TEXT,
  due_date       TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS code_modules (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key            TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  path           TEXT NOT NULL,
  language       TEXT NOT NULL DEFAULT 'TypeScript',
  layer          TEXT NOT NULL DEFAULT 'backend'
                 CHECK (layer IN ('frontend','backend','data','infra')),
  description_md TEXT NOT NULL DEFAULT '',
  owner_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  loc            INTEGER NOT NULL DEFAULT 0,
  risk           TEXT NOT NULL DEFAULT 'medium'
                 CHECK (risk IN ('low','medium','high')),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS requirement_code_links (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  requirement_id   INTEGER NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  code_module_id   INTEGER NOT NULL REFERENCES code_modules(id) ON DELETE CASCADE,
  note             TEXT NOT NULL DEFAULT '',
  UNIQUE (requirement_id, code_module_id)
);

CREATE TABLE IF NOT EXISTS test_cases (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key            TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  precondition_md TEXT NOT NULL DEFAULT '',
  steps_md       TEXT NOT NULL DEFAULT '',
  expected_md    TEXT NOT NULL DEFAULT '',
  type           TEXT NOT NULL DEFAULT 'functional'
                 CHECK (type IN ('functional','regression','edge','integration','performance')),
  priority       TEXT NOT NULL DEFAULT 'P2'
                 CHECK (priority IN ('P0','P1','P2','P3')),
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','draft','deprecated')),
  automated      INTEGER NOT NULL DEFAULT 0,
  owner_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  last_result    TEXT NOT NULL DEFAULT 'not_run'
                 CHECK (last_result IN ('pass','fail','blocked','skipped','not_run')),
  last_run_at    TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS test_case_requirement_links (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  test_case_id   INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  requirement_id INTEGER NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  UNIQUE (test_case_id, requirement_id)
);

CREATE TABLE IF NOT EXISTS test_case_code_links (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  test_case_id   INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  code_module_id INTEGER NOT NULL REFERENCES code_modules(id) ON DELETE CASCADE,
  UNIQUE (test_case_id, code_module_id)
);

CREATE TABLE IF NOT EXISTS change_requests (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id        INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requirement_id    INTEGER REFERENCES requirements(id) ON DELETE SET NULL,
  key               TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  description_md    TEXT NOT NULL DEFAULT '',
  reason            TEXT NOT NULL DEFAULT '',
  change_type       TEXT NOT NULL DEFAULT 'func_change'
                    CHECK (change_type IN ('func_change','bug_fix','perf','tech_debt','compliance')),
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','analyzing','pending_approval','approved','implemented','rejected')),
  risk_level        TEXT NOT NULL DEFAULT 'medium'
                    CHECK (risk_level IN ('low','medium','high')),
  affected_files    INTEGER NOT NULL DEFAULT 0,
  added_lines       INTEGER NOT NULL DEFAULT 0,
  removed_lines     INTEGER NOT NULL DEFAULT 0,
  auto_effort_days  REAL NOT NULL DEFAULT 0,
  final_effort_days REAL,
  created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  approved_at       TEXT
);

CREATE TABLE IF NOT EXISTS change_code_impacts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  change_request_id INTEGER NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
  code_module_id    INTEGER NOT NULL REFERENCES code_modules(id) ON DELETE CASCADE,
  impact_level      TEXT NOT NULL DEFAULT 'medium'
                    CHECK (impact_level IN ('low','medium','high')),
  action            TEXT NOT NULL DEFAULT 'modify'
                    CHECK (action IN ('modify','add','remove')),
  reason            TEXT NOT NULL DEFAULT '',
  estimated_days    REAL NOT NULL DEFAULT 0,
  UNIQUE (change_request_id, code_module_id)
);

CREATE TABLE IF NOT EXISTS effort_estimates (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  change_request_id INTEGER NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
  source            TEXT NOT NULL CHECK (source IN ('rule','manual','history','llm')),
  days              REAL NOT NULL,
  breakdown_json    TEXT NOT NULL DEFAULT '[]',
  confidence        TEXT NOT NULL DEFAULT 'medium'
                    CHECK (confidence IN ('low','medium','high')),
  notes             TEXT NOT NULL DEFAULT '',
  created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS test_change_suggestions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  change_request_id INTEGER NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
  test_case_id      INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  action            TEXT NOT NULL DEFAULT 'update'
                    CHECK (action IN ('update','add','remove')),
  reason            TEXT NOT NULL DEFAULT '',
  priority          TEXT NOT NULL DEFAULT 'P2'
                    CHECK (priority IN ('P0','P1','P2','P3')),
  resolved          INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  UNIQUE (change_request_id, test_case_id)
);

CREATE TABLE IF NOT EXISTS regression_plans (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id        INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  change_request_id INTEGER REFERENCES change_requests(id) ON DELETE SET NULL,
  key               TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'planned'
                    CHECK (status IN ('planned','running','completed','aborted')),
  scope_desc        TEXT NOT NULL DEFAULT '',
  created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL,
  started_at        TEXT,
  completed_at      TEXT
);

CREATE TABLE IF NOT EXISTS regression_plan_cases (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id            INTEGER NOT NULL REFERENCES regression_plans(id) ON DELETE CASCADE,
  test_case_id       INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  recommendation_score INTEGER NOT NULL DEFAULT 0,
  reason             TEXT NOT NULL DEFAULT '',
  required           INTEGER NOT NULL DEFAULT 1,
  UNIQUE (plan_id, test_case_id)
);

CREATE TABLE IF NOT EXISTS test_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id     INTEGER NOT NULL REFERENCES regression_plans(id) ON DELETE CASCADE,
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  result      TEXT NOT NULL DEFAULT 'not_run'
              CHECK (result IN ('pass','fail','blocked','skipped','not_run')),
  executor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  executed_at TEXT,
  notes       TEXT NOT NULL DEFAULT '',
  defect_ref  TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS documents (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id           INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  slug                 TEXT NOT NULL UNIQUE,
  category             TEXT NOT NULL DEFAULT 'knowledge'
                       CHECK (category IN ('pm','tech','test','knowledge')),
  content_md           TEXT NOT NULL DEFAULT '',
  summary              TEXT NOT NULL DEFAULT '',
  status               TEXT NOT NULL DEFAULT 'published'
                       CHECK (status IN ('published','draft')),
  version              INTEGER NOT NULL DEFAULT 1,
  author_id            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  related_requirement_id INTEGER REFERENCES requirements(id) ON DELETE SET NULL,
  related_code_module_id INTEGER REFERENCES code_modules(id) ON DELETE SET NULL,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   INTEGER,
  summary     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_requirements_project ON requirements(project_id);
CREATE INDEX IF NOT EXISTS idx_requirements_status ON requirements(status);
CREATE INDEX IF NOT EXISTS idx_tasks_requirement ON tasks(requirement_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_req_code_links_req ON requirement_code_links(requirement_id);
CREATE INDEX IF NOT EXISTS idx_req_code_links_code ON requirement_code_links(code_module_id);
CREATE INDEX IF NOT EXISTS idx_tc_req_links_req ON test_case_requirement_links(requirement_id);
CREATE INDEX IF NOT EXISTS idx_tc_code_links_code ON test_case_code_links(code_module_id);
CREATE INDEX IF NOT EXISTS idx_changes_requirement ON change_requests(requirement_id);
CREATE INDEX IF NOT EXISTS idx_changes_status ON change_requests(status);
CREATE INDEX IF NOT EXISTS idx_impacts_change ON change_code_impacts(change_request_id);
CREATE INDEX IF NOT EXISTS idx_estimates_change ON effort_estimates(change_request_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_change ON test_change_suggestions(change_request_id);
CREATE INDEX IF NOT EXISTS idx_plan_cases_plan ON regression_plan_cases(plan_id);
CREATE INDEX IF NOT EXISTS idx_runs_plan ON test_runs(plan_id);
CREATE INDEX IF NOT EXISTS idx_runs_case ON test_runs(test_case_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
`;
