"use server";

import { getI18n } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { establishSession, verifyCredentials } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function loginAction(formData: FormData): Promise<void> {
  const { t } = await getI18n();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "/dashboard");
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/dashboard";

  const { user, error } = await verifyCredentials(email, password);
  if (!user) {
    const params = new URLSearchParams();
    params.set("error", t(error ?? "Sign-in failed. Please try again."));
    if (next !== "/dashboard") params.set("next", next);
    const emailParam = email ? `&email=${encodeURIComponent(email)}` : "";
    redirect(`/login?${params.toString()}${emailParam}`);
  }

  await establishSession(user);
  logAudit(user, "login", "session", null, `${user.name} 登录系统`);

  if (!user.last_login_at) {
    getDb().prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(new Date().toISOString(), user.id);
  }

  redirect(next);
}
