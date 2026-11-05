import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getChangeDetail } from "@/lib/queries/changes";
import { formatDays, formatDateTime } from "@/lib/utils";
import type { EffortBreakdownItem } from "@/lib/types";
import { ActionBanner, readActionMessages, Alert, Button, Disclosure, Field, Input, Textarea, Markdown, PageHeader, SectionCard, StatusBadge, EmptyState, buttonStyles } from "@/components/ui";
import { analyzeChangeAction, estimateChangeAction, generateSuggestionsAction, resolveSuggestionAction, transitionChangeAction } from "../actions";

function ChangeAction({ id, action, children, status, source }: { id: number; action: (form: FormData) => Promise<void>; children: ReactNode; status?: string; source?: string }) {
  return <form action={action}><input type="hidden" name="id" value={id} />{status && <input type="hidden" name="status" value={status} />}{source && <input type="hidden" name="source" value={source} />}<Button type="submit" size="sm">{children}</Button></form>;
}

function readBreakdown(raw: string): EffortBreakdownItem[] {
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((x): x is EffortBreakdownItem => x !== null && typeof x === "object" && typeof x.label === "string" && typeof x.days === "number" && Number.isFinite(x.days));
  } catch { return []; }
}

export default async function ChangePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const user = await requireUser();
  const id = Number((await params).id);
  const detail = Number.isSafeInteger(id) ? getChangeDetail(id) : null;
  if (!detail) notFound();
  const { change: c, impacts, estimates, suggestions, plans } = detail;
  const editable = ["draft", "analyzing"].includes(c.status);
  const analyze = can(user, "change.analyze");
  const effort = can(user, "effort.write");
  const unresolved = suggestions.filter(s => !s.resolved).length;
  return <div className="space-y-5">
    <PageHeader eyebrow={c.key} title={c.title} description={t("Created by {name} · Updated {date}", { name: c.creator_name ?? t("Unknown"), date: formatDateTime(c.updated_at, locale) })} actions={<Link href="/changes" className={buttonStyles()}>{t("All changes")}</Link>} />
    <ActionBanner {...readActionMessages(await searchParams)} />
    <div className="flex flex-wrap items-center gap-2"><StatusBadge kind="change" value={c.status} /><StatusBadge kind="changeType" value={c.change_type} /><StatusBadge kind="risk" value={c.risk_level} />{c.requirement_id && <Link href={`/requirements/${c.requirement_id}`} className="text-sm text-primary">{c.requirement_key} · {c.requirement_title}</Link>}</div>
    <Alert title={t("Workflow")}>{t("Analyze impact → review estimates → submit for PM approval → resolve test suggestions → execute regression → mark implemented. Analysis uses explicit requirement/module links; it does not inspect repository changes.")}</Alert>
    <div className="grid gap-4 xl:grid-cols-3"><div className="space-y-4 xl:col-span-2">
      <SectionCard title={t("Change description")}><Markdown content={c.description_md} /><div className="mt-4 border-t border-border pt-3"><h4 className="text-sm font-medium">{t("Reason")}</h4><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{c.reason}</p><p className="mt-3 text-xs text-muted-foreground">{t("{count} files · +{added} / −{removed} lines", { count: c.affected_files, added: c.added_lines, removed: c.removed_lines })}</p></div></SectionCard>
      <SectionCard title={t("Impact analysis")} description={t("Derived from requirement-to-module traceability.")} actions={analyze && editable ? <ChangeAction id={id} action={analyzeChangeAction}>{impacts.length ? t("Reanalyze impact") : t("Analyze impact")}</ChangeAction> : undefined}>
        {impacts.map(i => <div key={i.id} className="space-y-2 border-b border-border py-3 last:border-0"><div className="flex flex-wrap items-center justify-between gap-2"><Link href={`/code/${i.code_module_id}`} className="font-medium text-primary">{i.module_key} · {i.module_name}</Link><div className="flex items-center gap-2"><StatusBadge kind="impact" value={i.impact_level} /><span className="text-xs">{formatDays(i.estimated_days, locale)}</span></div></div><p className="text-xs text-muted-foreground">{i.reason}</p></div>)}
        {!impacts.length && <EmptyState title={t("No analysis yet")} description={t("Link modules on the requirement, then run impact analysis.")} />}
        {editable && impacts.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{t("Reanalysis clears previous estimates and test suggestions so they cannot be mistaken for current conclusions.")}</p>}
      </SectionCard>
      <SectionCard title={t("Effort estimates")} description={t("Rule baseline: {rule} · Confirmed: {confirmed}", { rule: formatDays(c.auto_effort_days, locale), confirmed: formatDays(c.final_effort_days, locale) })} actions={effort && editable && impacts.length ? <div className="flex flex-wrap gap-2">{(["rule", "history", "llm"] as const).map(source => <ChangeAction key={source} id={id} source={source} action={estimateChangeAction}>{source === "llm" ? t("AI assisted") : source === "history" ? t("History calibration") : t("Rule estimate")}</ChangeAction>)}</div> : undefined}>
        {estimates.map(e => <div key={e.id} className="space-y-2 border-b border-border py-3 last:border-0"><div className="flex flex-wrap items-center gap-2"><StatusBadge kind="effortSource" value={e.source} /><strong className="text-sm">{formatDays(e.days, locale)}</strong><StatusBadge kind="confidence" value={e.confidence} /><span className="ml-auto text-xs text-muted-foreground">{formatDateTime(e.created_at, locale)}</span></div><p className="text-xs text-muted-foreground">{e.notes}</p><ul className="space-y-1 text-xs">{readBreakdown(e.breakdown_json).map((b, index) => <li key={index}>{b.label}: {formatDays(b.days, locale)}{b.note ? ` · ${b.note}` : ""}</li>)}</ul></div>)}
        {!estimates.length && <EmptyState title={t("No effort estimates")} />}
      </SectionCard>
      {effort && editable && impacts.length > 0 && <Disclosure summary={t("Confirm engineer estimate")}><form action={estimateChangeAction} className="space-y-3"><input type="hidden" name="id" value={id} /><input type="hidden" name="source" value="manual" /><Field label={t("Effort (person-days)")} required><Input name="days" type="number" min={0.1} max={10000} step={0.1} required defaultValue={c.final_effort_days ?? c.auto_effort_days} /></Field><Field label={t("Rationale")} required><Textarea name="notes" required maxLength={2000} /></Field><Button type="submit" variant="primary">{t("Save confirmed estimate")}</Button></form></Disclosure>}
      <SectionCard title={t("Test change suggestions · {count} unresolved", { count: unresolved })} description={t("Review the linked test, make the required changes, then resolve the suggestion.")} actions={analyze && ["analyzing", "approved"].includes(c.status) ? <ChangeAction id={id} action={generateSuggestionsAction}>{t("Generate suggestions")}</ChangeAction> : undefined}>
        {suggestions.map(s => <div key={s.id} className="space-y-2 border-b border-border py-3 last:border-0"><div className="flex flex-wrap items-center gap-2"><Link className="font-medium text-primary" href={`/tests/${s.test_case_id}`}>{s.test_key} · {s.test_title}</Link><StatusBadge kind="suggestion" value={s.action} /><StatusBadge kind="priority" value={s.priority} /></div><p className="text-xs text-muted-foreground">{s.reason}</p><div className="flex items-center justify-between gap-2"><span className={`text-xs ${s.resolved ? "text-emerald-600" : "text-muted-foreground"}`}>{s.resolved ? t("Resolved") : t("Needs review")}</span>{can(user, "testcase.write") && ["analyzing", "pending_approval", "approved"].includes(c.status) && <form action={resolveSuggestionAction}><input type="hidden" name="id" value={id} /><input type="hidden" name="suggestion_id" value={s.id} /><input type="hidden" name="resolved" value={s.resolved ? "0" : "1"} /><Button type="submit" size="xs">{s.resolved ? t("Reopen") : t("Mark reviewed and resolved")}</Button></form>}</div></div>)}
        {!suggestions.length && <EmptyState title={t("No suggestions generated")} />}
      </SectionCard>
    </div><div className="space-y-4">
      <SectionCard title={t("Review and approval")}>
        <p className="mb-3 text-xs text-muted-foreground">{t("Approval freezes analysis and confirms the final effort.")}</p>
        {analyze && c.status === "analyzing" && <ChangeAction id={id} action={transitionChangeAction} status="pending_approval">{t("Submit for approval")}</ChangeAction>}
        {can(user, "change.approve") && c.status === "pending_approval" && <div className="space-y-3"><form action={transitionChangeAction} className="space-y-3"><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="approved" /><Field label={t("Final effort (person-days)")} required><Input name="final_effort_days" type="number" min={0.1} max={10000} step={0.1} defaultValue={c.final_effort_days ?? c.auto_effort_days} required /></Field><Button type="submit" variant="primary">{t("Approve change")}</Button></form><ChangeAction id={id} action={transitionChangeAction} status="rejected">{t("Reject change")}</ChangeAction></div>}
        {c.approved_by && <p className="mt-3 text-xs text-muted-foreground">{t("Reviewed by {name} · {date}", { name: c.approver_name ?? t("Unknown"), date: formatDateTime(c.approved_at, locale) })}</p>}
        {c.status === "approved" && analyze && <div className="mt-4 space-y-3"><p className="text-xs text-muted-foreground">{t("Implementation requires resolved suggestions and a completed regression with required tests passing and no failed or blocked results.")}</p><ChangeAction id={id} action={transitionChangeAction} status="implemented">{t("Mark implemented")}</ChangeAction></div>}
        {c.status === "draft" && <p className="text-xs text-muted-foreground">{t("A Tech user must run impact analysis before submission.")}</p>}
      </SectionCard>
      <SectionCard title={t("Regression plans")} actions={can(user, "regression.create") && ["approved", "implemented"].includes(c.status) ? <Link href={`/regression/new?change=${id}`} className={buttonStyles({ size: "sm" })}>{t("Create plan")}</Link> : undefined}>
        {plans.map(p => <div key={p.id} className="space-y-1 border-b border-border py-3 last:border-0"><Link className="text-sm text-primary" href={`/regression/${p.id}`}>{p.key} · {p.title}</Link><div><StatusBadge kind="plan" value={p.status} /></div></div>)}
        {!plans.length && <EmptyState title={t("No regression plans")} description={t("Create a regression plan after approval.")} />}
      </SectionCard>
    </div></div>
  </div>;
}
