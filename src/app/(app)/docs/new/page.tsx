import { getI18n } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/auth";
import { listCodeModuleOptions, listRequirementOptions } from "@/lib/queries/docs";
import { DocForm, EMPTY_DOC_FORM } from "@/components/features/kb/doc-form";
import { PageHeader, SectionCard, ActionBanner, readActionMessages } from "@/components/ui";
import { saveDocumentAction } from "../actions";

export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  await requirePermission("doc.write");
  return <div><PageHeader title={t("New document")} description={t("Write Markdown and link it to requirements and code modules.")} /><ActionBanner {...readActionMessages(await searchParams)} /><SectionCard title={t("Document details")}><DocForm locale={locale} action={saveDocumentAction} defaults={EMPTY_DOC_FORM} requirements={listRequirementOptions()} codeModules={listCodeModuleOptions()} submitLabel={t("Create document")} cancelHref="/docs" /></SectionCard></div>;
}
