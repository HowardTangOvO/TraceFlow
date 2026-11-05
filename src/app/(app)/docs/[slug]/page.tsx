import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getDocumentBySlug, listSiblingDocuments } from "@/lib/queries/docs";
import { PageHeader, SectionCard, Markdown, StatusBadge, ActionBanner, readActionMessages, buttonStyles } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export default async function DocumentPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const user = await requireUser();
  const doc = getDocumentBySlug((await params).slug);
  if (!doc) notFound();
  return <div className="space-y-5">
    <PageHeader title={doc.title} description={t("Version {version} · {author} · {updated}", { version: doc.version, author: doc.author_name ?? t("Unknown author"), updated: formatDateTime(doc.updated_at, locale) })} actions={<><Link href="/docs" className={buttonStyles({ size: "sm" })}>{t("All documents")}</Link><a href={`/api/docs/${doc.slug}/export`} className={buttonStyles({ size: "sm" })}>{t("Export Markdown")}</a>{can(user, "doc.write") && <Link href={`/docs/${doc.slug}/edit`} className={buttonStyles({ variant: "primary", size: "sm" })}>{t("Edit document")}</Link>}</>} />
    <ActionBanner {...readActionMessages(await searchParams)} />
    <div className="grid gap-4 xl:grid-cols-3"><SectionCard title={t("Content")} className="xl:col-span-2"><Markdown content={doc.content_md} /></SectionCard><div className="space-y-4"><SectionCard title={t("Traceability")}><div className="space-y-3 text-xs"><div className="flex gap-2"><StatusBadge kind="doc" value={doc.category} /><StatusBadge kind="docStatus" value={doc.status} /></div><p>{doc.summary}</p>{doc.related_requirement_id && <Link className="block text-primary" href={`/requirements/${doc.related_requirement_id}`}>{doc.related_requirement_key} {t("·")}{doc.related_requirement_title}</Link>}{doc.related_code_module_id && <Link className="block text-primary" href={`/code/${doc.related_code_module_id}`}>{doc.related_code_module_key} {t("·")}{doc.related_code_module_name}</Link>}</div></SectionCard><SectionCard title={t("Related documents")}><div className="space-y-3 text-xs">{listSiblingDocuments(doc).map(item => <Link key={item.id} href={`/docs/${item.slug}`} className="block text-primary">{item.title}</Link>)}</div></SectionCard></div></div>
  </div>;
}
