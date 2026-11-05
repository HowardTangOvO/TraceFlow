"use server";

import { getI18n } from "@/lib/i18n/server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { requiredText, optionalText, optionalId, redirectWithError, redirectWithSuccess } from "@/lib/actions";
import { get, run, tx } from "@/lib/db/client";
import { getProject } from "@/lib/queries/common";
import { documentSlugExists, getDocumentBySlug } from "@/lib/queries/docs";
import { logAudit } from "@/lib/audit";

/** Keep relation validation and version checks in the transaction to prevent lost edits. */
export async function saveDocumentAction(form: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requirePermission("doc.write");
  const originalSlug = optionalText(form.get("original_slug"), 120);
  const returnTo = originalSlug ? `/docs/${encodeURIComponent(originalSlug)}/edit` : "/docs/new";
  let slug = "";
  try {
    const title = requiredText(form.get("title"), "title", 120);
    const category = requiredText(form.get("category"), "category");
    const status = requiredText(form.get("status"), "status");
    if (!["pm", "tech", "test", "knowledge"].includes(category)) throw new Error("Invalid category.");
    if (!["draft", "published"].includes(status)) throw new Error("Invalid document status.");
    const requirementId = optionalId(form.get("related_requirement_id"));
    const moduleId = optionalId(form.get("related_code_module_id"));
    if (form.get("related_requirement_id") && !requirementId) throw new Error("Invalid requirement ID.");
    if (form.get("related_code_module_id") && !moduleId) throw new Error("Invalid code module ID.");
    const project = getProject();
    const summary = optionalText(form.get("summary"), 300);
    const content = requiredText(form.get("content_md"), "content", 100000);
    const requestedSlug = optionalText(form.get("slug"), 120);
    slug = requestedSlug || originalSlug || `doc-${crypto.randomUUID()}`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Use lowercase letters, numbers and hyphens for the slug.");
    tx(() => {
      const existing = originalSlug ? getDocumentBySlug(originalSlug) : undefined;
      if (originalSlug && !existing) throw new Error("Document not found.");
      if (existing && Number(form.get("version")) !== existing.version) throw new Error("This document changed. Reload before saving.");
      if (documentSlugExists(slug, existing?.id)) throw new Error("This slug is already in use.");
      if (requirementId && !get("SELECT id FROM requirements WHERE id = ? AND project_id = ?", requirementId, project.id)) throw new Error("Requirement not found.");
      if (moduleId && !get("SELECT id FROM code_modules WHERE id = ? AND project_id = ?", moduleId, project.id)) throw new Error("Code module not found.");
      const now = new Date().toISOString();
      const id = existing ? existing.id : run(
        "INSERT INTO documents (project_id,title,slug,category,status,summary,content_md,author_id,related_requirement_id,related_code_module_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        project.id, title, slug, category, status, summary, content, user.id, requirementId, moduleId, now, now,
      ).lastInsertRowid;
      if (existing) run("UPDATE documents SET title=?,slug=?,category=?,status=?,summary=?,content_md=?,related_requirement_id=?,related_code_module_id=?,version=version+1,updated_at=? WHERE id=?", title, slug, category, status, summary, content, requirementId, moduleId, now, id);
      logAudit(user, existing ? "updated" : "created", "document", id, `${existing ? "Updated" : "Created"} document: ${title}`);
    });
  } catch (error) {
    redirectWithError(returnTo, t(error instanceof Error ? error.message : "Unable to save document."));
  }
  revalidatePath("/docs", "layout");
  redirectWithSuccess(`/docs/${slug}`, t("Document saved."));
}
