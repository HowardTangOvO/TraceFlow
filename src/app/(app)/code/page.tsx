import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listUsers } from "@/lib/queries/common";
import { listCodeModules } from "@/lib/queries/code";
import { ModuleFields } from "@/components/features/tech/module-fields";
import { ActionBanner, readActionMessages, Button, Disclosure, Input, PageHeader, SectionCard, StatusBadge, Table, THead, TBody, Tr, Th, Td, TableWrap, TableEmpty } from "@/components/ui";
import { saveModuleAction } from "./actions";

export async function generateMetadata() { const { t } = await getI18n(); return { title: t("Code modules") }; }

export default async function CodePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const user = await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const modules = listCodeModules(q);
  return <div className="space-y-5">
    <PageHeader title={t("Code modules")} description={t("Explore module ownership, risk and requirement-to-test traceability.")} />
    <ActionBanner {...readActionMessages(sp)} />
    <form className="flex gap-2"><Input name="q" defaultValue={q} placeholder={t("Search key, module or path")} /><Button type="submit">{t("Search")}</Button></form>
    <SectionCard title={t("{count} modules", { count: modules.length })}>
      <TableWrap><Table><THead><Tr><Th>{t("Module")}</Th><Th>{t("Path")}</Th><Th>{t("Layer / risk")}</Th><Th>{t("Owner")}</Th><Th>{t("Requirements")}</Th><Th>{t("Tests")}</Th></Tr></THead><TBody>
        {modules.map(m => <Tr key={m.id}><Td><Link className="font-medium text-primary" href={`/code/${m.id}`}>{m.key} · {m.name}</Link></Td><Td><code className="text-xs">{m.path}</code></Td><Td><div className="flex gap-1"><StatusBadge kind="layer" value={m.layer} /><StatusBadge kind="risk" value={m.risk} /></div></Td><Td>{m.owner_name ?? t("Unassigned")}</Td><Td>{m.requirement_count}</Td><Td>{m.test_count}</Td></Tr>)}
        {!modules.length && <TableEmpty colSpan={6}>{t("No matching modules")}</TableEmpty>}
      </TBody></Table></TableWrap>
    </SectionCard>
    {can(user, "code.write") && <Disclosure summary={t("Create module")}><form action={saveModuleAction} className="space-y-4"><ModuleFields locale={locale} users={listUsers()} /><Button type="submit" variant="primary">{t("Create module")}</Button></form></Disclosure>}
  </div>;
}
