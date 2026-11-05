import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { listChangeOptions, getChangeOption } from "@/lib/queries/regression";
import { listActiveTestCaseOptions } from "@/lib/queries/tests";
import { recommendCasesForChange, CHANGE_SCORING_RULES, BASELINE_SCORING_RULES } from "@/lib/regression";
import { PageHeader, ActionBanner, readActionMessages, SectionCard, Field, Select, Input, Textarea, Button, Checkbox, StatusBadge, Alert } from "@/components/ui";
import { createPlanAction } from "../actions";
export default async function NewPlanPage({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { t, locale } = await getI18n();
    await requirePermission("regression.create");
    const params = await searchParams;
    const rawChange = typeof params.change === "string" ? params.change : "";
    const selectedId = rawChange ? Number(rawChange) : null;
    const change = selectedId ? getChangeOption(selectedId) : undefined;
    const invalidChange = rawChange && (!Number.isInteger(selectedId) || !change || change.status === "rejected");
    const recommendations = invalidChange ? [] : recommendCasesForChange(selectedId, locale);
    const recommendedIds = new Set(recommendations.map(item => item.testCase.id));
    const remainingCases = listActiveTestCaseOptions().filter(item => !recommendedIds.has(item.id));
    return <div className="space-y-5">
    <PageHeader title={t("Create regression plan")} description={t("Recommendations combine requirement links, module coverage, risk and execution history.")} actions={<Link href="/regression">{t("\u2190 Regression plans")}</Link>}/>
    <ActionBanner {...readActionMessages(params)}/>
    <SectionCard title={t("Scoring rules")}><dl className="grid gap-3 sm:grid-cols-2">{(selectedId ? CHANGE_SCORING_RULES : BASELINE_SCORING_RULES).map(rule => <div key={rule.label} className="text-xs"><dt className="font-medium">{t(rule.label)} · {t("{points} points", { points: rule.points })}</dt><dd className="mt-1 text-muted-foreground">{t(rule.detail)}</dd></div>)}</dl></SectionCard>
    <SectionCard title={t("Choose scope")}><form method="get" action="/regression/new" className="flex items-end gap-3"><Field label={t("Related change")} htmlFor="scope-change" className="flex-1"><Select id="scope-change" name="change" defaultValue={selectedId ?? ""}><option value="">{t("Baseline regression")}</option>{listChangeOptions().filter(item => item.status !== "rejected").map(item => <option key={item.id} value={item.id}>{item.key} · {item.title}</option>)}</Select></Field><Button type="submit" variant="secondary">{t("Refresh recommendations")}</Button></form></SectionCard>
    {invalidChange ? <Alert tone="red">{t("The selected change is unavailable. Choose another scope.")}</Alert> : <form action={createPlanAction} className="space-y-4">
      <input type="hidden" name="change_request_id" value={selectedId ?? ""}/>
      <SectionCard title={t("Plan details")}><div className="space-y-3"><Field label={t("Title")} htmlFor="plan-title" required><Input id="plan-title" name="title" required maxLength={200} defaultValue={change ? t("{key} regression", { key: change.key }) : t("Baseline regression")}/></Field><Field label={t("Scope and acceptance notes")} htmlFor="plan-scope"><Textarea id="plan-scope" name="scope_desc" rows={3}/></Field></div></SectionCard>
      <SectionCard title={t("Recommended cases ({count})", { count: recommendations.length })} description={t("Scores \u2265 80 are required. Required recommendations are always included by the server.")}><div className="space-y-3">{recommendations.map(item => <div key={item.testCase.id} className="rounded-lg border border-border p-3"><Checkbox name="case_ids" value={item.testCase.id} defaultChecked label={<span>{item.testCase.key} · {item.testCase.title} <span className="text-muted-foreground">({item.score}/100{item.required ? t(", required") : ""})</span></span>}/><div className="mt-2 flex gap-2"><StatusBadge kind="priority" value={item.testCase.priority}/><StatusBadge kind="testResult" value={item.testCase.last_result}/></div><p className="mt-2 text-xs text-muted-foreground">{item.reason}</p></div>)}{!recommendations.length && <p className="text-sm text-muted-foreground">{t("No recommended cases. Select cases manually below.")}</p>}</div></SectionCard>
      {!!remainingCases.length && <SectionCard title={t("Additional cases")}><div className="grid gap-2 md:grid-cols-2">{remainingCases.map(item => <Checkbox key={item.id} name="case_ids" value={item.id} label={`${item.key} · ${item.title}`}/>)}</div></SectionCard>}
      <Button type="submit">{t("Create regression plan")}</Button>
    </form>}
  </div>;
}
