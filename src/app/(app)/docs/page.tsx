import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listDocuments } from "@/lib/queries/docs";
import { DOC_CATEGORY_META, DOC_STATUS_META, metaOptions } from "@/lib/constants";
import { PageHeader, SectionCard, FilterBar, SearchInput, SelectFilter, Button, StatusBadge, EmptyState, buttonStyles } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import type { DocCategory, DocStatus } from "@/lib/types";

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const user = await requireUser();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const category = typeof params.category === "string" && Object.hasOwn(DOC_CATEGORY_META, params.category) ? params.category as DocCategory : undefined;
  const status = typeof params.status === "string" && Object.hasOwn(DOC_STATUS_META, params.status) ? params.status as DocStatus : undefined;
  const docs = listDocuments({ q, category, status });
  return <div className="space-y-5">
    <PageHeader title={t("Knowledge documents")} description={t("Product requirements, technical designs and testing knowledge with traceable sources.")} actions={can(user, "doc.write") && <Link href="/docs/new" className={buttonStyles({ variant: "primary", size: "sm" })}>{t("New document")}</Link>} />
    <FilterBar action="/docs"><SearchInput defaultValue={q} placeholder={t("Search documents")} /><SelectFilter name="category" defaultValue={category} placeholder={t("All categories")} options={metaOptions(DOC_CATEGORY_META).map(option => ({ ...option, label: t(option.label) }))} /><SelectFilter name="status" defaultValue={status} placeholder={t("All statuses")} options={metaOptions(DOC_STATUS_META).map(option => ({ ...option, label: t(option.label) }))} /><Button type="submit" size="sm">{t("Filter")}</Button></FilterBar>
    {!docs.length && <EmptyState title={t("No documents found")} description={t("Change the filters or create a document.")} />}
    <div className="grid gap-4 lg:grid-cols-2">{docs.map(doc => <SectionCard key={doc.id} title={<Link href={`/docs/${doc.slug}`} className="hover:text-primary">{doc.title}</Link>} actions={<StatusBadge kind="docStatus" value={doc.status} />}>
      <div className="space-y-3 text-xs text-muted-foreground"><p>{doc.summary || t("No summary")}</p><div className="flex flex-wrap items-center gap-3"><StatusBadge kind="doc" value={doc.category} /><span>v{doc.version}</span><span>{doc.author_name}</span><time>{formatDateTime(doc.updated_at, locale)}</time></div>
      {doc.related_requirement_id && <Link className="block text-primary" href={`/requirements/${doc.related_requirement_id}`}>{doc.related_requirement_key} {t("·")}{doc.related_requirement_title}</Link>}
      {doc.related_code_module_id && <Link className="block text-primary" href={`/code/${doc.related_code_module_id}`}>{doc.related_code_module_key} {t("·")}{doc.related_code_module_name}</Link>}</div>
    </SectionCard>)}</div>
  </div>;
}
