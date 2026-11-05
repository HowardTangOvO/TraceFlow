import { getI18n } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { answerQuestion } from "@/lib/retrieval";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const { t, locale } = await getI18n();
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: t("Authentication required.") }, { status: 401 });
  if (!can(user, "ai.ask")) return Response.json({ error: t("Permission denied.") }, { status: 403 });
  let question: string;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("question" in body) || typeof body.question !== "string") throw new Error();
    question = body.question.trim();
    if (!question || question.length > 2000) throw new Error();
  } catch {
    return Response.json({ error: t("Provide a question between 1 and 2000 characters.") }, { status: 400 });
  }
  try {
    const result = await answerQuestion(question, locale);
    logAudit(user, "asked", "ai", null, question);
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: t("Knowledge search failed. Please try again.") }, { status: 500 });
  }
}
