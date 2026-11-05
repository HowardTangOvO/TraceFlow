import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listUsers } from "@/lib/queries/common";
import { getCodeDetail } from "@/lib/queries/code";
import { ModuleFields } from "@/components/features/tech/module-fields";
import { ActionBanner, readActionMessages, Button, Disclosure, Markdown, PageHeader, SectionCard, StatusBadge, EmptyState, buttonStyles } from "@/components/ui";
import { saveModuleAction } from "../actions";

export default async function ModulePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const user = await requireUser();
  const id = Number((await params).id);
  const detail = Number.isSafeInteger(id) ? getCodeDetail(id) : null;
  if (!detail) notFound();
  const { module: m, requirements, tests, changes, documents } = detail;
  return <div className="space-y-5">
    <PageHeader eyebrow={m.key} title={m.name} description={`${m.path} · ${m.language} · ${m.loc} LOC · ${m.owner_name ?? t("Unassigned")}`} actions={<Link href="/code" className={buttonStyles()}>{t("All modules")}</Link>} />
    <ActionBanner {...readActionMessages(await searchParams)} />
    <div className="flex gap-2"><StatusBadge kind="layer" value={m.layer} /><StatusBadge kind="risk" value={m.risk} /></div>
    <div className="grid gap-4 xl:grid-cols-3"><div className="space-y-4 xl:col-span-2">
      <SectionCard title={t("Module description")}><Markdown content={m.description_md || t("No description yet.")} /></SectionCard>
      <SectionCard title={t("Linked requirements")}>{requirements.map(r => <p key={r.id} className="py-2"><Link href={`/requirements/${r.id}`} className="text-primary">{r.key} · {r.title}</Link></p>)}{!requirements.length && <EmptyState title={t("No linked requirements")} description={t("Add traceability from the requirement detail page.")} />}</SectionCard>
      <SectionCard title={t("Test coverage")}>{tests.map(t => <div key={t.id} className="flex items-center justify-between gap-2 py-2"><Link href={`/tests/${t.id}`} className="text-primary">{t.key} · {t.title}</Link><StatusBadge kind="testResult" value={t.last_result} /></div>)}{!tests.length && <EmptyState title={t("No test coverage")} />}</SectionCard>
    </div><div className="space-y-4"><SectionCard title={t("Related changes")}>{changes.map(c => <p key={c.id} className="py-2"><Link href={`/changes/${c.id}`} className="text-primary">{c.key} · {c.title}</Link></p>)}{!changes.length && <EmptyState title={t("No related changes")} />}</SectionCard><SectionCard title={t("Knowledge")}>{documents.map(d => <p key={d.id} className="py-2"><Link className="text-primary" href={`/docs/${d.slug}`}>{d.title}</Link></p>)}{!documents.length && <EmptyState title={t("No linked documents")} />}</SectionCard></div></div>
    {can(user, "code.write") && <Disclosure summary={t("Edit module")}><form action={saveModuleAction} className="space-y-4"><input type="hidden" name="id" value={m.id} /><ModuleFields locale={locale} module={m} users={listUsers()} /><Button type="submit" variant="primary">{t("Save module")}</Button></form></Disclosure>}
  </div>;
}
