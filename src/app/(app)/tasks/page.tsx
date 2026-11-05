
import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { ActionBanner, Button, Disclosure, EmptyState, FilterBar, PageHeader, SearchInput, SelectFilter, StatCard, buttonStyles, readActionMessages } from "@/components/ui";
import { TaskBoard } from "@/components/features/pm/task-board";
import { TaskFields } from "@/components/features/pm/task-fields";
import { requireUser } from "@/lib/auth";
import { canWriteDimension } from "@/lib/rbac";
import { DIMENSION_META, TASK_STATUS_META, metaOptions } from "@/lib/constants";
import { listUsers } from "@/lib/queries/common";
import { listRequirementOptions } from "@/lib/queries/requirements";
import { getTaskStats, listTasks } from "@/lib/queries/tasks";
import type { Dimension, TaskStatus } from "@/lib/types";
import { createTaskAction } from "./actions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Tasks") };
}

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const user = await requireUser();
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
  const dimension = first(params.dimension);
  const status = first(params.status);
  const q = first(params.q).trim();
  const assignee = Number(first(params.assignee));
  const tasks = listTasks({
    q,
    dimension: Object.hasOwn(DIMENSION_META, dimension) ? dimension as Dimension : undefined,
    status: Object.hasOwn(TASK_STATUS_META, status) ? status as TaskStatus : undefined,
    assignee: Number.isInteger(assignee) && assignee > 0 ? assignee : undefined,
  });
  const users = listUsers();
  const dimensions = (Object.keys(DIMENSION_META) as Dimension[]).filter(value => canWriteDimension(user, value));
  const stats = getTaskStats();
  const query = new URLSearchParams();
  for (const key of ["dimension", "status", "q", "assignee"]) {
    const value = first(params[key]);
    if (value) query.set(key, value);
  }
  const returnTo = `/tasks${query.size ? `?${query}` : ""}`;
  return <div className="space-y-5">
    <PageHeader title={t("Tasks")} description={t("Track work across product, engineering and testing. Drag a card or use its status form to move it.")} actions={<Link href="/requirements" className={buttonStyles({ size: "sm" })}>{t("Requirements")}</Link>} />
    <ActionBanner {...readActionMessages(params)} />
    <div className="grid gap-3 sm:grid-cols-4"><StatCard label={t("Total")} value={stats.total} /><StatCard label={t("Completed")} value={stats.done} tone="green" /><StatCard label={t("Blocked / overdue")} value={`${stats.blocked} / ${stats.overdue}`} tone="red" /><StatCard label={t("Estimate / actual (days)")} value={`${stats.estimateDays} / ${stats.actualDays}`} /></div>
    <FilterBar action="/tasks"><SearchInput defaultValue={q} placeholder={t("Search tasks or requirements")} /><SelectFilter name="dimension" defaultValue={dimension} placeholder={t("All dimensions")} options={metaOptions(DIMENSION_META).map(option => ({ ...option, label: t(option.label) }))} /><SelectFilter name="status" defaultValue={status} placeholder={t("All statuses")} options={metaOptions(TASK_STATUS_META).map(option => ({ ...option, label: t(option.label) }))} /><SelectFilter name="assignee" defaultValue={assignee > 0 ? String(assignee) : ""} placeholder={t("All assignees")} options={users.map(row => ({ value: String(row.id), label: row.name }))} /><Button type="submit" size="sm">{t("Filter")}</Button><Link href="/tasks" className={buttonStyles({ size: "sm", variant: "ghost" })}>{t("Reset")}</Link></FilterBar>
    {dimensions.length > 0 && <Disclosure summary={t("Create task")} defaultOpen={first(params.new) === "1"}><form action={createTaskAction} className="space-y-4"><input type="hidden" name="returnTo" value={returnTo} /><TaskFields locale={locale} dimensions={dimensions} users={users} requirements={listRequirementOptions()} requirementId={Number(first(params.requirement)) || undefined} /><Button type="submit" variant="primary">{t("Create task")}</Button></form></Disclosure>}
    {tasks.length ? <TaskBoard tasks={tasks} returnTo={returnTo} writableDimensions={dimensions} today={new Date().toISOString().slice(0, 10)} /> : <EmptyState title={t("No matching tasks")} description={t("Adjust the filters or create a task.")} />}
  </div>;
}
