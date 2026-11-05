
import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionBanner, Button, Disclosure, Field, Input, Markdown, PageHeader, SectionCard, Select, StatusBadge, Textarea, buttonStyles, readActionMessages } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PRIORITY_META, REQUIREMENT_STATUS_META, metaOptions } from "@/lib/constants";
import { listUsers } from "@/lib/queries/common";
import { getRequirementDetail } from "@/lib/queries/requirements";
import { formatDateTime } from "@/lib/utils";
import { linkCodeModuleAction, linkTestCaseAction, unlinkCodeModuleAction, unlinkTestCaseAction, updateRequirementAction } from "../actions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Requirement detail") };
}

export default async function RequirementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const user = await requireUser();
  const { id } = await params;
  const detail = getRequirementDetail(Number(id));
  if (!detail) notFound();
  const { requirement: req, tasks, codeModules, testCases, changes, documents } = detail;
  const writable = can(user, "requirement.write");
  const returnTo = `/requirements/${req.id}`;
  const context = <><input type="hidden" name="requirement_id" value={req.id} /><input type="hidden" name="returnTo" value={returnTo} /></>;
  return <div className="space-y-5">
    <PageHeader eyebrow={`${req.key} · v${req.version}`} title={req.title} description={t("Owner: {name} · Updated {date}", { name: detail.owner_name ?? t("Unassigned"), date: formatDateTime(req.updated_at, locale) })} actions={<><Link href="/requirements" className={buttonStyles({ size: "sm" })}>{t("Requirements")}</Link>{can(user, "task.write") && <Link href={`/tasks?new=1&requirement=${req.id}`} className={buttonStyles({ size: "sm" })}>{t("Create task")}</Link>}{can(user, "change.create") && <Link href={`/changes?requirement=${req.id}`} className={buttonStyles({ variant: "primary", size: "sm" })}>{t("Request change")}</Link>}</>} />
    <ActionBanner {...readActionMessages(await searchParams)} />
    <div className="flex gap-2"><StatusBadge kind="requirement" value={req.status} /><StatusBadge kind="priority" value={req.priority} /></div>
    <div className="grid gap-4 xl:grid-cols-3"><div className="space-y-4 xl:col-span-2">
      <SectionCard title={t("Requirement")}><Markdown content={req.description_md || t("No description yet.")} />{req.source && <p className="mt-4 text-xs text-muted-foreground">{t("Source:")} {req.source}</p>}</SectionCard>
      <SectionCard title={t("Tasks ({count})", { count: tasks.length })}><ul className="divide-y divide-border">{tasks.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs"><Link href={`/tasks/${row.id}`} className="text-primary hover:underline">{row.key} · {row.title}</Link><StatusBadge kind="task" value={row.status} /></li>)}</ul>{!tasks.length && <p className="text-xs text-muted-foreground">{t("No linked tasks.")}</p>}</SectionCard>
      <SectionCard title={t("Code modules ({count})", { count: codeModules.length })}><ul className="divide-y divide-border">{codeModules.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs"><div><Link href={`/code/${row.id}`} className="text-primary hover:underline">{row.key} · {row.name}</Link><p className="mt-1 text-muted-foreground">{row.path}{row.note ? ` · ${row.note}` : ""}</p></div>{writable && <form action={unlinkCodeModuleAction}>{context}<input type="hidden" name="code_module_id" value={row.id} /><Button type="submit" size="xs" variant="ghost">{t("Unlink")}</Button></form>}</li>)}</ul>{!codeModules.length && <p className="text-xs text-muted-foreground">{t("No linked modules.")}</p>}
      {writable && detail.availableCodeModules.length > 0 && <form action={linkCodeModuleAction} className="mt-4 space-y-3">{context}<Field label={t("Module")} htmlFor="link-module"><Select id="link-module" name="code_module_id" required defaultValue=""><option value="" disabled>{t("Select a module")}</option>{detail.availableCodeModules.map(row => <option key={row.id} value={row.id}>{row.key} · {row.name}</option>)}</Select></Field><Field label={t("Link note")} htmlFor="link-note"><Input id="link-note" name="note" maxLength={200} /></Field><Button type="submit" size="sm">{t("Link module")}</Button></form>}</SectionCard>
      <SectionCard title={t("Test cases ({count})", { count: testCases.length })}><ul className="divide-y divide-border">{testCases.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs"><Link href={`/tests/${row.id}`} className="text-primary hover:underline">{row.key} · {row.title}</Link><div className="flex items-center gap-2"><StatusBadge kind="testResult" value={row.last_result} />{writable && <form action={unlinkTestCaseAction}>{context}<input type="hidden" name="test_case_id" value={row.id} /><Button type="submit" size="xs" variant="ghost">{t("Unlink")}</Button></form>}</div></li>)}</ul>{!testCases.length && <p className="text-xs text-muted-foreground">{t("No linked test cases.")}</p>}
      {writable && detail.availableTestCases.length > 0 && <form action={linkTestCaseAction} className="mt-4 space-y-3">{context}<Field label={t("Test case")} htmlFor="link-test"><Select id="link-test" name="test_case_id" required defaultValue=""><option value="" disabled>{t("Select a test case")}</option>{detail.availableTestCases.map(row => <option key={row.id} value={row.id}>{row.key} · {row.title}</option>)}</Select></Field><Button type="submit" size="sm">{t("Link test case")}</Button></form>}</SectionCard>
      {writable && <Disclosure summary={t("Edit requirement")}><form action={updateRequirementAction} className="space-y-4"><input type="hidden" name="id" value={req.id} /><input type="hidden" name="version" value={req.version} /><input type="hidden" name="returnTo" value={returnTo} /><Field label={t("Title")} htmlFor="req-title" required><Input id="req-title" name="title" required maxLength={200} defaultValue={req.title} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label={t("Status")} htmlFor="req-status"><Select id="req-status" name="status" defaultValue={req.status}>{metaOptions(REQUIREMENT_STATUS_META).map(row => <option key={row.value} value={row.value}>{t(row.label)}</option>)}</Select></Field><Field label={t("Priority")} htmlFor="req-priority"><Select id="req-priority" name="priority" defaultValue={req.priority}>{metaOptions(PRIORITY_META).map(row => <option key={row.value} value={row.value}>{t(row.label)}</option>)}</Select></Field><Field label={t("Owner")} htmlFor="req-owner"><Select id="req-owner" name="owner_id" defaultValue={req.owner_id ?? ""}><option value="">{t("Unassigned")}</option>{listUsers().map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</Select></Field><Field label={t("Source")} htmlFor="req-source"><Input id="req-source" name="source" maxLength={120} defaultValue={req.source} /></Field></div><Field label={t("Description (Markdown)")} htmlFor="req-description"><Textarea id="req-description" name="description_md" rows={12} maxLength={20000} defaultValue={req.description_md} /></Field><Button type="submit" variant="primary">{t("Save requirement")}</Button></form></Disclosure>}
    </div><div className="space-y-4"><SectionCard title={t("Changes ({count})", { count: changes.length })}><ul className="space-y-4 text-xs">{changes.map(row => <li key={row.id} className="space-y-2"><Link href={`/changes/${row.id}`} className="block text-primary hover:underline">{row.key} · {row.title}</Link><StatusBadge kind="change" value={row.status} /></li>)}</ul>{!changes.length && <p className="text-xs text-muted-foreground">{t("No change requests.")}</p>}</SectionCard><SectionCard title={t("Documents ({count})", { count: documents.length })}><ul className="space-y-3 text-xs">{documents.map(row => <li key={row.id}><Link href={`/docs/${row.slug}`} className="text-primary hover:underline">{row.title}</Link></li>)}</ul>{!documents.length && <p className="text-xs text-muted-foreground">{t("No related documents.")}</p>}</SectionCard></div></div>
  </div>;
}
