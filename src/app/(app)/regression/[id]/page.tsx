import { localizeRecommendationReason } from "@/lib/regression";
import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getRegressionPlanRow, getPlanStats, listPlanCases, listPlanRuns, listAvailableCases } from "@/lib/queries/regression";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, SectionCard, ActionBanner, readActionMessages, StatCard, StatusBadge, Progress, Markdown, Button, Field, Select, Input, Textarea, Disclosure, Checkbox, TableWrap, Table, THead, Th, TBody, Tr, Td, TableEmpty, Alert } from "@/components/ui";
import { addPlanCaseAction, removePlanCaseAction, recordResultAction, updatePlanStatusAction } from "../actions";
export default async function PlanPage({ params, searchParams }: {
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
    const plan = getRegressionPlanRow(id);
    if (!plan)
        notFound();
    const stats = getPlanStats(id);
    const cases = listPlanCases(id);
    const runs = listPlanRuns(id);
    const execute = can(user, "regression.execute");
    const editScope = can(user, "regression.create") && plan.status === "planned";
    const choices = editScope ? listAvailableCases(id) : [];
    return <div className="space-y-5">
    <PageHeader title={`${plan.key} · ${plan.title}`} description={t("Created by {name} · {date}", { name: plan.creator_name ?? "—", date: formatDateTime(plan.created_at, locale) })} actions={<Link href="/regression">{t("\u2190 Regression plans")}</Link>}/>
    <ActionBanner {...readActionMessages(await searchParams)}/>
    <div className="flex flex-wrap items-center gap-3"><StatusBadge kind="plan" value={plan.status}/>{plan.change_request_id && <Link className="text-sm text-primary" href={`/changes/${plan.change_request_id}`}>{plan.change_key} · {plan.change_title}</Link>}{plan.requirement_id && <Link className="text-sm text-primary" href={`/requirements/${plan.requirement_id}`}>{plan.requirement_key}</Link>}</div>
    <div className="grid gap-3 sm:grid-cols-4"><StatCard label={t("Executed")} value={`${stats.executed} / ${stats.total}`}/><StatCard label={t("Pass rate")} value={`${stats.passRate}%`}/><StatCard label={t("Failed / blocked")} value={`${stats.failed} / ${stats.blocked}`} tone="red"/><StatCard label={t("Not run / skipped")} value={`${stats.notRun} / ${stats.skipped}`} tone="amber"/></div>
    <SectionCard title={t("Execution progress")} description={t("Pass rate = passed / all recorded case results. Completion closes execution and does not mean release approval.")}><Progress value={stats.executeRate} showLabel/><div className="mt-4"><Markdown content={plan.scope_desc || t("No additional scope notes.")}/></div>{execute && <div className="mt-4 flex flex-wrap gap-2">{plan.status === "planned" && <form action={updatePlanStatusAction}><input type="hidden" name="plan_id" value={id}/><input type="hidden" name="status" value="start"/><Button type="submit">{t("Start execution")}</Button></form>}{plan.status === "running" && <form action={updatePlanStatusAction}><input type="hidden" name="plan_id" value={id}/><input type="hidden" name="status" value="complete"/><Button type="submit">{t("Complete plan")}</Button></form>}{["planned", "running"].includes(plan.status) && <form action={updatePlanStatusAction}><input type="hidden" name="plan_id" value={id}/><input type="hidden" name="status" value="abort"/><Button type="submit" variant="danger">{t("Abort plan")}</Button></form>}</div>}</SectionCard>
    {plan.status === "completed" && (stats.failed > 0 || stats.blocked > 0 || stats.skipped > 0) && <Alert tone="amber" title={t("Execution completed with outstanding results")}>{t("Review failed, blocked or skipped cases before release. This plan remains an immutable execution record.")}</Alert>}
    <SectionCard title={t("Plan cases ({count})", { count: cases.length })} description={t("Required cases cannot be removed or skipped. Scope is frozen when execution starts.")}><div className="space-y-3">{cases.map(item => <div key={item.test_case_id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><Link href={`/tests/${item.test_case_id}`} className="text-sm font-medium text-primary">{item.key} · {item.title}</Link><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{item.recommendation_score}/100{item.required ? t(" \u00B7 Required") : ""}</span><StatusBadge kind="testResult" value={item.run_result ?? "not_run"}/></div></div><p className="mt-2 text-xs text-muted-foreground">{localizeRecommendationReason(item.reason, locale)}</p>{item.run_executed_at && <p className="mt-2 text-xs">{item.executor_name} · {formatDateTime(item.run_executed_at, locale)} · {item.run_notes} {item.run_defect_ref}</p>}{editScope && !item.required && <form action={removePlanCaseAction} className="mt-3"><input type="hidden" name="plan_id" value={id}/><input type="hidden" name="test_case_id" value={item.test_case_id}/><Button type="submit" size="sm" variant="ghost">{t("Remove from plan")}</Button></form>}{execute && plan.status === "running" && <Disclosure summary={t("Record execution result")} className="mt-3"><form action={recordResultAction} className="space-y-3"><input type="hidden" name="plan_id" value={id}/><input type="hidden" name="test_case_id" value={item.test_case_id}/><div className="grid gap-3 sm:grid-cols-2"><Field label={t("Result")} htmlFor={`result-${item.test_case_id}`}><Select name="result" id={`result-${item.test_case_id}`} defaultValue={item.run_result && item.run_result !== "not_run" ? item.run_result : "pass"}><option value="pass">{t("Pass")}</option><option value="fail">{t("Fail")}</option><option value="blocked">{t("Blocked")}</option>{!item.required && <option value="skipped">{t("Skipped")}</option>}</Select></Field><Field label={t("Defect reference")} htmlFor={`defect-${item.test_case_id}`}><Input name="defect_ref" id={`defect-${item.test_case_id}`} maxLength={200} defaultValue={item.run_defect_ref ?? ""} placeholder={t("DEF-123 or issue URL")}/></Field></div><Field label={t("Notes")} htmlFor={`notes-${item.test_case_id}`}><Textarea name="notes" id={`notes-${item.test_case_id}`} rows={2} defaultValue={item.run_notes ?? ""}/></Field><Button type="submit" size="sm">{t("Save result")}</Button></form></Disclosure>}</div>)}{!cases.length && <p className="text-sm text-muted-foreground">{t("No cases in this plan.")}</p>}</div></SectionCard>
    {editScope && choices.length > 0 && <Disclosure summary={t("Add test case")}><form action={addPlanCaseAction} className="space-y-3"><input type="hidden" name="plan_id" value={id}/><Field label={t("Test case")} htmlFor="additional-case"><Select name="test_case_id" id="additional-case">{choices.map(item => <option key={item.id} value={item.id}>{item.key} · {item.title}</option>)}</Select></Field><Checkbox name="required" label={t("Mark as required")}/><Button type="submit">{t("Add case")}</Button></form></Disclosure>}
    <SectionCard title={t("Execution history")}><TableWrap><Table><THead><Tr><Th>{t("Case")}</Th><Th>{t("Result")}</Th><Th>{t("Executor / time")}</Th><Th>{t("Notes / defect")}</Th></Tr></THead><TBody>{runs.map(run => <Tr key={run.id}><Td><Link className="text-primary" href={`/tests/${run.test_case_id}`}>{run.case_key} · {run.case_title}</Link></Td><Td><StatusBadge kind="testResult" value={run.result}/></Td><Td>{run.executor_name ?? "—"}<p className="text-xs text-muted-foreground">{formatDateTime(run.executed_at, locale)}</p></Td><Td>{run.notes || "—"}<p className="text-xs">{run.defect_ref}</p></Td></Tr>)}{!runs.length && <TableEmpty colSpan={4}>{t("No executions recorded.")}</TableEmpty>}</TBody></Table></TableWrap></SectionCard>
  </div>;
}
