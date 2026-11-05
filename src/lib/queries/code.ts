import { all, get } from "@/lib/db/client";
import type { ChangeRequest, CodeModuleWithMeta, Document, Requirement, TestCase } from "@/lib/types";

const MODULE_SELECT = `SELECT m.*, u.name AS owner_name,
  (SELECT COUNT(*) FROM requirement_code_links WHERE code_module_id=m.id) AS requirement_count,
  (SELECT COUNT(*) FROM test_case_code_links WHERE code_module_id=m.id) AS test_count
  FROM code_modules m LEFT JOIN users u ON u.id=m.owner_id`;

export function listCodeModules(q = "", layer = "", risk = ""): CodeModuleWithMeta[] {
  return all<CodeModuleWithMeta>(`${MODULE_SELECT}
    WHERE (?='' OR m.key LIKE ? OR m.name LIKE ? OR m.path LIKE ?)
    AND (?='' OR m.layer=?) AND (?='' OR m.risk=?) ORDER BY m.key`,
    q, `%${q}%`, `%${q}%`, `%${q}%`, layer, layer, risk, risk);
}

export function getCodeDetail(id: number) {
  const module = get<CodeModuleWithMeta>(`${MODULE_SELECT} WHERE m.id=?`, id);
  if (!module) return null;
  return {
    module,
    requirements: all<Requirement>(`SELECT r.* FROM requirements r JOIN requirement_code_links l
      ON l.requirement_id=r.id WHERE l.code_module_id=? ORDER BY r.key`, id),
    tests: all<TestCase>(`SELECT t.* FROM test_cases t JOIN test_case_code_links l
      ON l.test_case_id=t.id WHERE l.code_module_id=? ORDER BY t.key`, id),
    changes: all<ChangeRequest>(`SELECT c.* FROM change_requests c JOIN change_code_impacts i
      ON i.change_request_id=c.id WHERE i.code_module_id=? ORDER BY c.id DESC`, id),
    documents: all<Document>("SELECT * FROM documents WHERE related_code_module_id=? ORDER BY updated_at DESC", id),
  };
}
