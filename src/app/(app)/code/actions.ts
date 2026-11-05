"use server";

import { getI18n } from "@/lib/i18n/server";

import { revalidatePath } from "next/cache";
import { requireUser, assertPermission } from "@/lib/auth";
import { requiredText, optionalText, optionalId, redirectWithError, redirectWithSuccess } from "@/lib/actions";
import { get, run, tx } from "@/lib/db/client";
import { getProject } from "@/lib/queries/common";
import { logAudit } from "@/lib/audit";
import { CODE_LAYER_META, RISK_META } from "@/lib/constants";
import type { CodeModule } from "@/lib/types";

export async function saveModuleAction(form: FormData): Promise<void> {
  const { t } = await getI18n();
  const user = await requireUser();
  const id = optionalId(form.get("id"));
  const returnTo = id ? `/code/${id}` : "/code";
  let savedId = id;
  try {
    assertPermission(user, "code.write");
    const rawId = form.get("id");
    if (rawId !== null && rawId !== "" && (typeof rawId !== "string" || !/^[1-9]\d*$/.test(rawId) || !id || !Number.isSafeInteger(id))) {
      throw new Error("Invalid module ID.");
    }
    const name = requiredText(form.get("name"), "module name", 200);
    const path = requiredText(form.get("path"), "repository path", 500);
    const language = requiredText(form.get("language"), "language", 60);
    const layer = String(form.get("layer") ?? "");
    const risk = String(form.get("risk") ?? "");
    if (!Object.hasOwn(CODE_LAYER_META, layer) || !Object.hasOwn(RISK_META, risk)) throw new Error("Invalid layer or risk.");
    const loc = Number(form.get("loc"));
    if (!Number.isSafeInteger(loc) || loc < 0) throw new Error("Lines of code must be a non-negative integer.");
    const owner = optionalId(form.get("owner_id"));
    const rawOwner = form.get("owner_id");
    if (rawOwner !== null && rawOwner !== "" && (typeof rawOwner !== "string" || !/^[1-9]\d*$/.test(rawOwner) || !owner || !Number.isSafeInteger(owner))) {
      throw new Error("Invalid owner ID.");
    }
    if (owner && !get("SELECT id FROM users WHERE id=? AND active=1", owner)) throw new Error("Owner is unavailable.");
    const now = new Date().toISOString();
    savedId = tx(() => {
      if (id) {
        if (!get<CodeModule>("SELECT * FROM code_modules WHERE id=?", id)) throw new Error("Module not found.");
        run(`UPDATE code_modules SET name=?,path=?,language=?,layer=?,risk=?,owner_id=?,loc=?,description_md=?,updated_at=? WHERE id=?`,
          name, path, language, layer, risk, owner, loc, optionalText(form.get("description_md")), now, id);
        logAudit(user, "updated", "code_module", id, `Updated module ${name}`);
        return id;
      }
      const next = Number(get<{ n: number }>("SELECT COALESCE(MAX(id),0)+1 AS n FROM code_modules")?.n ?? 1);
      const key = `MOD-${String(next).padStart(3, "0")}`;
      const created = run(`INSERT INTO code_modules (project_id,key,name,path,language,layer,risk,owner_id,loc,description_md,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, getProject().id, key, name, path, language, layer, risk, owner, loc, optionalText(form.get("description_md")), now, now).lastInsertRowid;
      logAudit(user, "created", "code_module", created, `Created module ${key}`);
      return created;
    });
  } catch (error) {
    redirectWithError(returnTo, t(error instanceof Error ? error.message : "Unable to save module."));
  }
  revalidatePath("/code");
  revalidatePath(`/code/${savedId}`);
  revalidatePath("/dashboard");
  redirectWithSuccess(`/code/${savedId}`, t("Module saved."));
}
