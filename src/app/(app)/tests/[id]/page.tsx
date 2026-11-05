import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listUsers } from "@/lib/queries/common";
import { getTestCaseRow, listCaseCodeModules, listCaseRequirements, listCaseRuns } from "@/lib/queries/tests";
import { formatDateTime } from "@/lib/utils";
import { ActionBanner, readActionMessages, PageHeader, SectionCard, Markdown, StatusBadge, Disclosure, Button, TableWrap, Table, THead, Th, TBody, Tr, Td, TableEmpty } from "@/components/ui";
import { TestCaseFormFields } from "@/components/features/test/test-case-fields";
import { TraceFields } from "@/components/features/test/trace-fields";
import { saveTestCaseAction } from "../actions";
export default async function TestCasePage({ params, searchParams }: {
    params: Promise<{
        id: string;
    }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { t, locale } = await getI18n();
    const user = await requireUser();
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0)
        notFound();
    const item = getTestCaseRow(id);
    if (!item)
        notFound();
    const requirements = listCaseRequirements(id);
    const modules = listCaseCodeModules(id);
    const runs = listCaseRuns(id);
    return <div className="space-y-5">
    <PageHeader title={`${item.key} · ${item.title}`} description={t("{owner} · Updated {date}", { owner: item.owner_name ?? t("Unassigned"), date: formatDateTime(item.updated_at, locale) })} actions={<Link href="/tests">{t("\u2190 Test cases")}</Link>}/>
    <ActionBanner {...readActionMessages(await searchParams)}/>
    <div className="flex flex-wrap gap-2"><StatusBadge kind="testType" value={item.type}/><StatusBadge kind="priority" value={item.priority}/><StatusBadge kind="testCaseStatus" value={item.status}/><StatusBadge kind="testResult" value={item.last_result}/></div>
    <div className="grid gap-4 xl:grid-cols-3"><div className="space-y-4 xl:col-span-2"><SectionCard title={t("Preconditions")}><Markdown content={item.precondition_md || t("No preconditions recorded.")}/></SectionCard><SectionCard title={t("Test steps")}><Markdown content={item.steps_md}/></SectionCard><SectionCard title={t("Expected results")}><Markdown content={item.expected_md}/></SectionCard></div><div className="space-y-4"><SectionCard title={t("Requirements")}><ul className="space-y-2 text-sm">{requirements.map(req => <li key={req.id}><Link className="text-primary" href={`/requirements/${req.id}`}>{req.key} · {req.title}</Link></li>)}{!requirements.length && <li>{t("No linked requirements.")}</li>}</ul></SectionCard><SectionCard title={t("Code coverage")}><ul className="space-y-2 text-sm">{modules.map(module => <li key={module.id}><Link className="text-primary" href={`/code/${module.id}`}>{module.key} · {module.name}</Link><p className="break-all text-xs text-muted-foreground">{module.path}</p></li>)}{!modules.length && <li>{t("No linked modules.")}</li>}</ul></SectionCard></div></div>
    {can(user, "testcase.write") && <Disclosure summary={t("Edit test case")}><form action={saveTestCaseAction} className="space-y-4"><input type="hidden" name="id" value={id}/><TestCaseFormFields locale={locale} users={listUsers()} values={item}/><TraceFields locale={locale} projectId={item.project_id} requirementIds={requirements.map(req => req.id)} moduleIds={modules.map(module => module.id)}/><Button type="submit">{t("Save case")}</Button></form></Disclosure>}
    <SectionCard title={t("Execution history")}><TableWrap><Table><THead><Tr><Th>{t("Plan")}</Th><Th>{t("Result")}</Th><Th>{t("Executor / time")}</Th><Th>{t("Notes / defect")}</Th></Tr></THead><TBody>{runs.map(run => <Tr key={run.id}><Td><Link className="text-primary" href={`/regression/${run.plan_id}`}>{run.plan_key} · {run.plan_title}</Link></Td><Td><StatusBadge kind="testResult" value={run.result}/></Td><Td>{run.executor_name ?? "—"}<p className="text-xs text-muted-foreground">{formatDateTime(run.executed_at, locale)}</p></Td><Td><p>{run.notes || "—"}</p><p className="text-xs">{run.defect_ref}</p></Td></Tr>)}{!runs.length && <TableEmpty colSpan={4}>{t("No executions yet.")}</TableEmpty>}</TBody></Table></TableWrap></SectionCard>
  </div>;
}
