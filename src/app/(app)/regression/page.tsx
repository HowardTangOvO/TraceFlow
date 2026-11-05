import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listRegressionPlans } from "@/lib/queries/regression";
import { formatDateTime, percent } from "@/lib/utils";
import { PageHeader, ActionBanner, readActionMessages, StatCard, TableWrap, Table, THead, Th, TBody, Tr, Td, TableEmpty, StatusBadge, Progress, buttonStyles } from "@/components/ui";
export async function generateMetadata() { const { t } = await getI18n(); return { title: t("Regression plans") }; }
export default async function RegressionPage({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { t, locale } = await getI18n();
    const user = await requireUser();
    const plans = listRegressionPlans();
    return <div className="space-y-5">
    <PageHeader title={t("Regression plans")} description={t("Select regression coverage, record executions and trace results back to changes.")} actions={can(user, "regression.create") ? <Link className={buttonStyles()} href="/regression/new">{t("Create plan")}</Link> : undefined}/>
    <ActionBanner {...readActionMessages(await searchParams)}/>
    <div className="grid gap-3 sm:grid-cols-3"><StatCard label={t("All plans")} value={plans.length}/><StatCard label={t("Running")} value={plans.filter(plan => plan.status === "running").length}/><StatCard label={t("Completed")} value={plans.filter(plan => plan.status === "completed").length}/></div>
    <TableWrap><Table><THead><Tr><Th>{t("Plan")}</Th><Th>{t("Change")}</Th><Th>{t("Status")}</Th><Th>{t("Execution")}</Th><Th>{t("Pass rate")}</Th></Tr></THead><TBody>{plans.map(plan => <Tr key={plan.id}><Td><Link href={`/regression/${plan.id}`} className="font-medium text-primary">{plan.key} · {plan.title}</Link><p className="text-xs text-muted-foreground">{plan.creator_name ?? "—"} · {formatDateTime(plan.created_at, locale)}</p></Td><Td>{plan.change_request_id ? <Link className="text-primary" href={`/changes/${plan.change_request_id}`}>{plan.change_key}</Link> : t("Baseline")}</Td><Td><StatusBadge kind="plan" value={plan.status}/></Td><Td><div className="min-w-32"><Progress value={percent(plan.executed_cases, plan.total_cases)} showLabel/><p className="mt-1 text-xs text-muted-foreground">{t("{executed} / {total} cases", { executed: plan.executed_cases, total: plan.total_cases })}</p></div></Td><Td>{percent(plan.passed_cases, plan.executed_cases)}%<p className="text-xs text-muted-foreground">{t("{count} failed", { count: plan.failed_cases })}</p></Td></Tr>)}{!plans.length && <TableEmpty colSpan={5}>{t("No regression plans yet.")}</TableEmpty>}</TBody></Table></TableWrap>
  </div>;
}
