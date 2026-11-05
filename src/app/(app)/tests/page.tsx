import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getProject, listUsers } from "@/lib/queries/common";
import { getTestStats, listTestCases } from "@/lib/queries/tests";
import { TEST_CASE_TYPE_META, TEST_CASE_STATUS_META, TEST_RESULT_META, PRIORITY_META, metaOptions } from "@/lib/constants";
import { ActionBanner, readActionMessages, PageHeader, StatCard, Disclosure, Button, TableWrap, Table, THead, Th, TBody, Tr, Td, TableEmpty, StatusBadge, FilterBar, SearchInput, SelectFilter, FilterActions } from "@/components/ui";
import { TestCaseFormFields } from "@/components/features/test/test-case-fields";
import { TraceFields } from "@/components/features/test/trace-fields";
import { saveTestCaseAction } from "./actions";
export async function generateMetadata() { const { t } = await getI18n(); return { title: t("Test cases") }; }
export default async function TestsPage({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { t, locale } = await getI18n();
    const user = await requireUser();
    const params = await searchParams;
    const value = (name: string) => typeof params[name] === "string" ? params[name] as string : "";
    const cases = listTestCases({ q: value("q"), type: value("type"), status: value("status"), priority: value("priority"), result: value("result") });
    const stats = getTestStats();
    return <div className="space-y-5">
    <PageHeader title={t("Test cases")} description={t("Maintain test steps, expected results and requirement-to-code coverage.")} actions={<Link href="/regression">{t("Regression plans \u2192")}</Link>}/>
    <ActionBanner {...readActionMessages(params)}/>
    <div className="grid gap-3 sm:grid-cols-4"><StatCard label={t("All cases")} value={stats.total}/><StatCard label={t("Active")} value={stats.active}/><StatCard label={t("Failed / blocked")} value={`${stats.fail} / ${stats.blocked}`} tone="red"/><StatCard label={t("Requirements covered")} value={`${stats.requirementCovered} / ${stats.requirementTotal}`}/></div>
    <FilterBar action="/tests"><SearchInput defaultValue={value("q")} placeholder={t("Search cases\u2026")}/><SelectFilter name="type" defaultValue={value("type")} placeholder={t("All types")} options={metaOptions(TEST_CASE_TYPE_META).map(option => ({ ...option, label: t(option.label) }))}/><SelectFilter name="status" defaultValue={value("status")} placeholder={t("All statuses")} options={metaOptions(TEST_CASE_STATUS_META).map(option => ({ ...option, label: t(option.label) }))}/><SelectFilter name="priority" defaultValue={value("priority")} placeholder={t("All priorities")} options={metaOptions(PRIORITY_META).map(option => ({ ...option, label: t(option.label) }))}/><SelectFilter name="result" defaultValue={value("result")} placeholder={t("All results")} options={metaOptions(TEST_RESULT_META).map(option => ({ ...option, label: t(option.label) }))}/><FilterActions><Button type="submit" size="sm">{t("Apply")}</Button><Link href="/tests" className="text-xs text-muted-foreground">{t("Reset")}</Link></FilterActions></FilterBar>
    <TableWrap><Table><THead><Tr><Th>{t("Case")}</Th><Th>{t("Type / priority")}</Th><Th>{t("Status")}</Th><Th>{t("Coverage")}</Th><Th>{t("Latest result")}</Th></Tr></THead><TBody>{cases.map(item => <Tr key={item.id}><Td><Link className="font-medium text-primary" href={`/tests/${item.id}`}>{item.key} · {item.title}</Link><p className="text-xs text-muted-foreground">{item.owner_name ?? t("Unassigned")}{item.automated ? t(" \u00B7 Automated") : ""}</p></Td><Td><StatusBadge kind="testType" value={item.type}/> <StatusBadge kind="priority" value={item.priority}/></Td><Td><StatusBadge kind="testCaseStatus" value={item.status}/></Td><Td>{t("{requirements} requirements · {modules} modules", { requirements: item.requirement_count, modules: item.code_count })}</Td><Td><StatusBadge kind="testResult" value={item.last_result}/></Td></Tr>)}{!cases.length && <TableEmpty colSpan={5}>{t("No matching test cases.")}</TableEmpty>}</TBody></Table></TableWrap>
    {can(user, "testcase.write") && <Disclosure summary={t("Create test case")}><form action={saveTestCaseAction} className="space-y-4"><TestCaseFormFields locale={locale} users={listUsers()}/><TraceFields locale={locale} projectId={getProject().id}/><Button type="submit">{t("Create case")}</Button></form></Disclosure>}
  </div>;
}
