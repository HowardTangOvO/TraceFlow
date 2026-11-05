import { getI18n } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getDocumentBySlug, listCodeModuleOptions, listRequirementOptions } from "@/lib/queries/docs";
import { DocForm } from "@/components/features/kb/doc-form";
import { PageHeader, SectionCard, ActionBanner, readActionMessages } from "@/components/ui";
import { saveDocumentAction } from "../../actions";

export default async function EditDocumentPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  await requirePermission("doc.write");
  const doc = getDocumentBySlug((await params).slug);
  if (!doc) notFound();
  return <div><PageHeader title={t("Edit: {title}", { title: doc.title })} /><ActionBanner {...readActionMessages(await searchParams)} /><SectionCard title={t("Document details")}><DocForm locale={locale} action={saveDocumentAction} defaults={doc} version={doc.version} originalSlug={doc.slug} requirements={listRequirementOptions()} codeModules={listCodeModuleOptions()} submitLabel={t("Save document")} cancelHref={`/docs/${doc.slug}`} /></SectionCard></div>;
}
