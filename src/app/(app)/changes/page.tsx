import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listChanges, changeRequirementOptions } from "@/lib/queries/changes";
import { CHANGE_STATUS_META, metaOptions } from "@/lib/constants";
import { formatDays } from "@/lib/utils";
import { ChangeFields } from "@/components/features/tech/change-fields";
import { ActionBanner, readActionMessages, Button, Disclosure, Input, Select, PageHeader, SectionCard, StatusBadge, Table, THead, TBody, Tr, Th, Td, TableWrap, TableEmpty } from "@/components/ui";
import { createChangeAction } from "./actions";

export async function generateMetadata() { const { t } = await getI18n(); return { title: t("Change center") }; }

export default async function ChangesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const user = await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const changes = listChanges(q, status);
  return <div className="space-y-5">
    <PageHeader title={t("Change center")} description={t("Trace requirement changes through impact analysis, effort review, approval and regression.")} />
    <ActionBanner {...readActionMessages(sp)} />
    <form className="flex flex-wrap gap-2"><Input name="q" className="max-w-sm" defaultValue={q} placeholder={t("Search change key or title")} /><Select className="max-w-xs" name="status" defaultValue={status}><option value="">{t("All statuses")}</option>{metaOptions(CHANGE_STATUS_META).map(x => <option key={x.value} value={x.value}>{t(x.label)}</option>)}</Select><Button type="submit">{t("Filter")}</Button></form>
    <SectionCard title={t("{count} changes", { count: changes.length })}><TableWrap><Table><THead><Tr><Th>{t("Change")}</Th><Th>{t("Requirement")}</Th><Th>{t("Status")}</Th><Th>{t("Risk")}</Th><Th>{t("Effort")}</Th><Th>{t("Impacted modules")}</Th></Tr></THead><TBody>
      {changes.map(c => <Tr key={c.id}><Td><Link href={`/changes/${c.id}`} className="font-medium text-primary">{c.key} · {c.title}</Link></Td><Td>{c.requirement_id ? <Link className="text-primary" href={`/requirements/${c.requirement_id}`}>{c.requirement_key}</Link> : "—"}</Td><Td><StatusBadge kind="change" value={c.status} /></Td><Td><StatusBadge kind="risk" value={c.risk_level} /></Td><Td>{formatDays(c.final_effort_days ?? c.auto_effort_days, locale)}</Td><Td>{c.impact_count}</Td></Tr>)}
      {!changes.length && <TableEmpty colSpan={6}>{t("No matching changes")}</TableEmpty>}
    </TBody></Table></TableWrap></SectionCard>
    {can(user, "change.create") && <Disclosure summary={t("Create change request")} defaultOpen={Boolean(sp.requirement || sp.new)}><form action={createChangeAction} className="space-y-4"><ChangeFields locale={locale} requirements={changeRequirementOptions()} requirementId={Number(sp.requirement) || undefined} /><Button type="submit" variant="primary">{t("Create draft")}</Button></form></Disclosure>}
  </div>;
}
