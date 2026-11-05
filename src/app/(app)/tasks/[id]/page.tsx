
import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionBanner, Button, Disclosure, Markdown, PageHeader, SectionCard, StatusBadge, buttonStyles, readActionMessages } from "@/components/ui";
import { TaskFields } from "@/components/features/pm/task-fields";
import { requireUser } from "@/lib/auth";
import { canWriteDimension } from "@/lib/rbac";
import { DIMENSION_META } from "@/lib/constants";
import { listUsers } from "@/lib/queries/common";
import { listRequirementOptions } from "@/lib/queries/requirements";
import { getTaskDetail } from "@/lib/queries/tasks";
import { formatDate, formatDays } from "@/lib/utils";
import type { Dimension } from "@/lib/types";
import { deleteTaskAction, updateTaskAction } from "../actions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Task detail") };
}

export default async function TaskPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const user = await requireUser();
  const { id } = await params;
  const detail = getTaskDetail(Number(id));
  if (!detail) notFound();
  const { task, requirement, siblingTasks } = detail;
  const writable = canWriteDimension(user, task.dimension);
  const dimensions = (Object.keys(DIMENSION_META) as Dimension[]).filter(value => canWriteDimension(user, value));
  return <div className="space-y-5">
    <PageHeader eyebrow={task.key} title={task.title} actions={<Link href="/tasks" className={buttonStyles({ size: "sm" })}>{t("Back to tasks")}</Link>} />
    <ActionBanner {...readActionMessages(await searchParams)} />
    <div className="flex flex-wrap gap-3"><StatusBadge kind="task" value={task.status} /><StatusBadge kind="dimension" value={task.dimension} /><span className="text-xs text-muted-foreground">{task.assignee_name ?? t("Unassigned")}  {t("· Due")} {formatDate(task.due_date, locale)}  {t("· Estimate")} {formatDays(task.estimate_days, locale)}  {t("· Actual")} {formatDays(task.actual_days, locale)}</span></div>
    <div className="grid gap-4 xl:grid-cols-3"><div className="space-y-4 xl:col-span-2"><SectionCard title={t("Description")}><Markdown content={task.description_md || t("No description yet.")} /></SectionCard>
      {writable && <Disclosure summary={t("Edit task")}><form action={updateTaskAction} className="space-y-4"><input type="hidden" name="id" value={task.id} /><input type="hidden" name="returnTo" value={`/tasks/${task.id}`} /><TaskFields locale={locale} task={task} dimensions={dimensions} users={listUsers()} requirements={listRequirementOptions()} /><Button type="submit" variant="primary">{t("Save task")}</Button></form></Disclosure>}
    </div><div className="space-y-4"><SectionCard title={t("Requirement")}>{requirement ? <Link href={`/requirements/${requirement.id}`} className="text-sm text-primary hover:underline">{requirement.key} · {requirement.title}</Link> : <p className="text-xs text-muted-foreground">{t("No linked requirement.")}</p>}</SectionCard><SectionCard title={t("Related tasks")}><ul className="space-y-3 text-xs">{siblingTasks.map(row => <li key={row.id}><Link href={`/tasks/${row.id}`} className="text-primary hover:underline">{row.key} · {row.title}</Link></li>)}</ul>{!siblingTasks.length && <p className="text-xs text-muted-foreground">{t("No related tasks.")}</p>}</SectionCard>
    {writable && <Disclosure summary={t("Delete task")}><form action={deleteTaskAction} className="space-y-3"><input type="hidden" name="task_id" value={task.id} /><input type="hidden" name="returnTo" value={`/tasks/${task.id}`} /><p className="text-xs text-muted-foreground">{t("This permanently removes this task.")}</p><Button type="submit" variant="danger">{t("Delete task")}</Button></form></Disclosure>}</div></div>
  </div>;
}
