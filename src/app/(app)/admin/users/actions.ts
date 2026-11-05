"use server";

import { getI18n } from "@/lib/i18n/server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { optionalId, requiredText, redirectWithError, redirectWithSuccess } from "@/lib/actions";
import { run, tx } from "@/lib/db/client";
import { countActiveAdmins, getManagedUser } from "@/lib/queries/admin";
import { logAudit } from "@/lib/audit";

/** Preserve an active administrator so account management cannot lock itself out. */
export async function updateUserAction(form: FormData): Promise<void> {
  const { t } = await getI18n();
  const actor = await requirePermission("admin.users");
  try {
    const id = optionalId(form.get("id"));
    const role = requiredText(form.get("role"), "role");
    if (!id || !["admin", "pm", "tech", "test"].includes(role)) throw new Error("Invalid user or role.");
    const active = form.get("active") === "1" ? 1 : 0;
    tx(() => {
      const user = getManagedUser(id);
      if (!user) throw new Error("User not found.");
      if (id === actor.id && !active) throw new Error("You cannot disable your own account.");
      if (user.role === "admin" && user.active && (role !== "admin" || !active) && countActiveAdmins(id) === 0) throw new Error("At least one active administrator is required.");
      run("UPDATE users SET role = ?, active = ? WHERE id = ?", role, active, id);
      logAudit(actor, "updated", "user", id, `Updated ${user.email}: role=${role}, active=${active}`);
    });
  } catch (error) {
    redirectWithError("/admin/users", t(error instanceof Error ? error.message : "Unable to update user."));
  }
  revalidatePath("/", "layout");
  redirectWithSuccess("/admin/users", t("User updated."));
}
