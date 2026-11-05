import { all, get, type SqlValue } from "@/lib/db/client";
import type {
  ChangeRequest,
  CodeModule,
  Document,
  Priority,
  Requirement,
  RequirementStatus,
  RequirementWithMeta,
  TaskWithMeta,
  TestCase,
} from "@/lib/types";

export interface RequirementFilters {
  status?: RequirementStatus;
  priority?: Priority;
  owner?: number;
  q?: string;
}

export interface RequirementStatusCounts {
  total: number;
  draft: number;
  active: number;
  changed: number;
  deprecated: number;
}

const LIST_SELECT = `
  SELECT r.*, u.name AS owner_name,
         (SELECT COUNT(*) FROM tasks t WHERE t.requirement_id = r.id) AS task_count,
         (SELECT COUNT(*) FROM tasks t WHERE t.requirement_id = r.id AND t.status = 'done') AS done_task_count,
         (SELECT COUNT(*) FROM requirement_code_links l WHERE l.requirement_id = r.id) AS code_count,
         (SELECT COUNT(*) FROM test_case_requirement_links l WHERE l.requirement_id = r.id) AS test_count,
         (SELECT COUNT(*) FROM change_requests c WHERE c.requirement_id = r.id) AS change_count
  FROM requirements r
  LEFT JOIN users u ON u.id = r.owner_id`;

/** 需求列表（支持状态 / 优先级 / 负责人 / 关键词筛选） */
export function listRequirements(filters: RequirementFilters = {}): RequirementWithMeta[] {
  const where: string[] = [];
  const params: SqlValue[] = [];

  if (filters.status) {
    where.push("r.status = ?");
    params.push(filters.status);
  }
  if (filters.priority) {
    where.push("r.priority = ?");
    params.push(filters.priority);
  }
  if (filters.owner) {
    where.push("r.owner_id = ?");
    params.push(filters.owner);
  }
  if (filters.q) {
    const like = `%${filters.q}%`;
    where.push("(r.key LIKE ? OR r.title LIKE ? OR r.description_md LIKE ? OR r.source LIKE ?)");
    params.push(like, like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return all<RequirementWithMeta>(`${LIST_SELECT} ${whereSql} ORDER BY r.updated_at DESC, r.id DESC`, ...params);
}

/** 各状态需求数量（列表 Tab 计数，不受 Tab 之外的筛选影响时更稳定） */
export function getRequirementStatusCounts(): RequirementStatusCounts {
  const rows = all<{ status: RequirementStatus; count: number }>(
    "SELECT status, COUNT(*) AS count FROM requirements GROUP BY status",
  );
  const counts: RequirementStatusCounts = { total: 0, draft: 0, active: 0, changed: 0, deprecated: 0 };
  for (const row of rows) {
    counts[row.status] = Number(row.count);
    counts.total += Number(row.count);
  }
  return counts;
}

/** 需求下拉选项（任务创建 / 表单使用） */
export function listRequirementOptions(): Pick<Requirement, "id" | "key" | "title" | "status">[] {
  return all<Pick<Requirement, "id" | "key" | "title" | "status">>(
    "SELECT id, key, title, status FROM requirements ORDER BY key",
  );
}

export interface RequirementCodeLink extends CodeModule {
  link_id: number;
  note: string;
}

export interface RequirementTestCaseLink extends TestCase {
  link_id: number;
}

export interface RequirementDetail {
  requirement: Requirement;
  owner_name: string | null;
  tasks: TaskWithMeta[];
  codeModules: RequirementCodeLink[];
  testCases: RequirementTestCaseLink[];
  changes: ChangeRequest[];
  documents: Document[];
  availableCodeModules: Pick<CodeModule, "id" | "key" | "name" | "path">[];
  availableTestCases: Pick<TestCase, "id" | "key" | "title" | "type" | "status" | "last_result">[];
}

/** 需求详情 + 全链路追溯关系 */
export function getRequirementDetail(id: number): RequirementDetail | null {
  const requirement = get<Requirement>("SELECT * FROM requirements WHERE id = ?", id);
  if (!requirement) return null;

  const owner = get<{ name: string }>("SELECT name FROM users WHERE id = ?", requirement.owner_id ?? -1);

  const tasks = all<TaskWithMeta>(
    `SELECT t.*, r.key AS requirement_key, r.title AS requirement_title,
            u.name AS assignee_name, u.avatar_color AS assignee_color
     FROM tasks t
     LEFT JOIN requirements r ON r.id = t.requirement_id
     LEFT JOIN users u ON u.id = t.assignee_id
     WHERE t.requirement_id = ? ORDER BY t.key`,
    id,
  );

  const codeModules = all<RequirementCodeLink>(
    `SELECT cm.*, l.id AS link_id, l.note
     FROM requirement_code_links l
     JOIN code_modules cm ON cm.id = l.code_module_id
     WHERE l.requirement_id = ? ORDER BY cm.key`,
    id,
  );

  const testCases = all<RequirementTestCaseLink>(
    `SELECT tc.*, l.id AS link_id
     FROM test_case_requirement_links l
     JOIN test_cases tc ON tc.id = l.test_case_id
     WHERE l.requirement_id = ? ORDER BY tc.key`,
    id,
  );

  const changes = all<ChangeRequest>(
    "SELECT * FROM change_requests WHERE requirement_id = ? ORDER BY updated_at DESC",
    id,
  );

  const documents = all<Document>(
    "SELECT * FROM documents WHERE related_requirement_id = ? ORDER BY updated_at DESC",
    id,
  );

  const availableCodeModules = all<Pick<CodeModule, "id" | "key" | "name" | "path">>(
    `SELECT id, key, name, path FROM code_modules
     WHERE id NOT IN (SELECT code_module_id FROM requirement_code_links WHERE requirement_id = ?)
     ORDER BY key`,
    id,
  );

  const availableTestCases = all<
    Pick<TestCase, "id" | "key" | "title" | "type" | "status" | "last_result">
  >(
    `SELECT id, key, title, type, status, last_result FROM test_cases
     WHERE id NOT IN (SELECT test_case_id FROM test_case_requirement_links WHERE requirement_id = ?)
     ORDER BY key`,
    id,
  );

  return {
    requirement,
    owner_name: owner?.name ?? null,
    tasks,
    codeModules,
    testCases,
    changes,
    documents,
    availableCodeModules,
    availableTestCases,
  };
}
