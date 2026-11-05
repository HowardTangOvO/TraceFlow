import { all, get } from "@/lib/db/client";
import type { DocCategory, DocStatus, Document } from "@/lib/types";

/** 知识库列表/详情页使用的文档富查询结果（带作者与关联对象） */
export interface DocumentWithMeta extends Document {
  author_name: string | null;
  author_color: string | null;
  related_requirement_key: string | null;
  related_requirement_title: string | null;
  related_code_module_key: string | null;
  related_code_module_name: string | null;
}

export type DocCategoryFilter = DocCategory | "all";

export interface DocumentFilter {
  category?: DocCategoryFilter;
  status?: DocStatus | "all";
  q?: string;
}

const DOCUMENT_SELECT = `
  SELECT d.*,
         u.name AS author_name,
         u.avatar_color AS author_color,
         r.key AS related_requirement_key,
         r.title AS related_requirement_title,
         c.key AS related_code_module_key,
         c.name AS related_code_module_name
  FROM documents d
  LEFT JOIN users u ON u.id = d.author_id
  LEFT JOIN requirements r ON r.id = d.related_requirement_id
  LEFT JOIN code_modules c ON c.id = d.related_code_module_id
`;

/** 转义 LIKE 通配符（与 SQL 中的 ESCAPE '\' 配合） */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** 知识库文档列表：支持分类、状态与关键词（标题/摘要/正文/slug）过滤，按更新时间倒序 */
export function listDocuments(filter: DocumentFilter = {}): DocumentWithMeta[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filter.category && filter.category !== "all") {
    conditions.push("d.category = ?");
    params.push(filter.category);
  }
  if (filter.status && filter.status !== "all") {
    conditions.push("d.status = ?");
    params.push(filter.status);
  }
  const q = filter.q?.trim();
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    conditions.push(
      "(d.title LIKE ? ESCAPE '\\' OR d.summary LIKE ? ESCAPE '\\' OR d.content_md LIKE ? ESCAPE '\\' OR d.slug LIKE ? ESCAPE '\\')",
    );
    params.push(pattern, pattern, pattern, pattern);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return all<DocumentWithMeta>(
    `${DOCUMENT_SELECT} ${where} ORDER BY d.updated_at DESC, d.id DESC`,
    ...params,
  );
}

export function getDocumentBySlug(slug: string): DocumentWithMeta | undefined {
  return get<DocumentWithMeta>(`${DOCUMENT_SELECT} WHERE d.slug = ?`, slug);
}

export function getDocumentById(id: number): DocumentWithMeta | undefined {
  return get<DocumentWithMeta>(`${DOCUMENT_SELECT} WHERE d.id = ?`, id);
}

export function documentSlugExists(slug: string, excludeId?: number): boolean {
  const row = excludeId
    ? get<{ id: number }>("SELECT id FROM documents WHERE slug = ? AND id != ?", slug, excludeId)
    : get<{ id: number }>("SELECT id FROM documents WHERE slug = ?", slug);
  return Boolean(row);
}

export interface DocCategoryCounts {
  all: number;
  pm: number;
  tech: number;
  test: number;
  knowledge: number;
}

/** 分类 Tab 上的数量统计 */
export function getDocCategoryCounts(): DocCategoryCounts {
  const counts: DocCategoryCounts = { all: 0, pm: 0, tech: 0, test: 0, knowledge: 0 };
  for (const row of all<{ category: DocCategory; c: number }>(
    "SELECT category, COUNT(*) AS c FROM documents GROUP BY category",
  )) {
    const count = Number(row.c);
    counts[row.category] = count;
    counts.all += count;
  }
  return counts;
}

export interface DocRelationOption {
  id: number;
  key: string;
  title: string;
}

/** 文档表单：关联需求下拉 */
export function listRequirementOptions(): DocRelationOption[] {
  return all<DocRelationOption>("SELECT id, key, title FROM requirements ORDER BY id");
}

/** 文档表单：关联代码模块下拉 */
export function listCodeModuleOptions(): DocRelationOption[] {
  return all<DocRelationOption>(
    "SELECT id, key, name AS title FROM code_modules ORDER BY id",
  );
}

/** 同类文档（详情页侧栏推荐） */
export function listSiblingDocuments(doc: DocumentWithMeta, limit = 4): DocumentWithMeta[] {
  return all<DocumentWithMeta>(
    `${DOCUMENT_SELECT} WHERE d.category = ? AND d.id != ? ORDER BY d.updated_at DESC LIMIT ?`,
    doc.category,
    doc.id,
    limit,
  );
}
