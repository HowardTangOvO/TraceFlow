
import { createTranslator, type Locale } from "@/lib/i18n";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { DIMENSION_META, TASK_STATUS_META, metaOptions } from "@/lib/constants";
import type { Dimension, PublicUser, Requirement, Task } from "@/lib/types";

export function TaskFields({ task, dimensions, users, requirements, requirementId, locale }: {
  locale: Locale;
  task?: Task;
  dimensions: Dimension[];
  users: PublicUser[];
  requirements: Pick<Requirement, "id" | "key" | "title">[];
  requirementId?: number;
}) {
  const t = createTranslator(locale);
  return <div className="grid gap-4 sm:grid-cols-2">
    <Field label={t("Title")} htmlFor="task-title" required className="sm:col-span-2"><Input id="task-title" name="title" required maxLength={200} defaultValue={task?.title} /></Field>
    <Field label={t("Dimension")} htmlFor="task-dimension"><Select id="task-dimension" name="dimension" defaultValue={task?.dimension ?? dimensions[0]}>{dimensions.map(value => <option key={value} value={value}>{t(DIMENSION_META[value].label)}</option>)}</Select></Field>
    <Field label={t("Requirement")} htmlFor="task-requirement"><Select id="task-requirement" name="requirement_id" defaultValue={task?.requirement_id ?? requirementId ?? ""}><option value="">{t("Unlinked")}</option>{requirements.map(row => <option key={row.id} value={row.id}>{row.key} · {row.title}</option>)}</Select></Field>
    <Field label={t("Assignee")} htmlFor="task-assignee"><Select id="task-assignee" name="assignee_id" defaultValue={task?.assignee_id ?? ""}><option value="">{t("Unassigned")}</option>{users.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</Select></Field>
    {task && <Field label={t("Status")} htmlFor="task-status"><Select id="task-status" name="status" defaultValue={task.status}>{metaOptions(TASK_STATUS_META).map(row => <option key={row.value} value={row.value}>{t(row.label)}</option>)}</Select></Field>}
    <Field label={t("Estimate (person-days)")} htmlFor="task-estimate"><Input id="task-estimate" name="estimate_days" type="number" min="0" step="0.1" required defaultValue={task?.estimate_days ?? 0} /></Field>
    {task && <Field label={t("Actual (person-days)")} htmlFor="task-actual"><Input id="task-actual" name="actual_days" type="number" min="0" step="0.1" required defaultValue={task.actual_days} /></Field>}
    <Field label={t("Due date")} htmlFor="task-due"><Input id="task-due" name="due_date" type="date" defaultValue={task?.due_date ?? ""} /></Field>
    <Field label={t("Description (Markdown)")} htmlFor="task-description" className="sm:col-span-2"><Textarea id="task-description" name="description_md" rows={8} maxLength={20000} defaultValue={task?.description_md} /></Field>
  </div>;
}
