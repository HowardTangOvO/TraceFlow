import { getI18n } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { getDocumentBySlug } from "@/lib/queries/docs";
import { logAudit } from "@/lib/audit";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { t, locale } = await getI18n();
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: t("Authentication required.") }, { status: 401 });
  const doc = getDocumentBySlug((await params).slug);
  if (!doc) return Response.json({ error: t("Document not found.") }, { status: 404 });
  logAudit(user, "exported", "document", doc.id, `Exported document: ${doc.title}`);
  return new Response(doc.content_md, { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="document-${doc.id}.md"`, "cache-control": "no-store" } });
}
