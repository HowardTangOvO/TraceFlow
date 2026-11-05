"use client";

import { useI18n } from "@/components/i18n/provider";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarClock, GripVertical, UserRound } from "lucide-react";
import { Avatar, Button, StatusBadge } from "@/components/ui";
import { DIMENSION_META, TASK_BOARD_COLUMNS, TASK_STATUS_META, type Tone } from "@/lib/constants";
import { cn, formatDate, formatDays, truncate } from "@/lib/utils";
import type { Dimension, TaskStatus, TaskWithMeta } from "@/lib/types";
import { updateTaskStatusAction } from "@/app/(app)/tasks/actions";

const TONE_BORDER: Record<Tone, string> = {
  gray: "border-t-slate-400",
  blue: "border-t-blue-500",
  green: "border-t-emerald-500",
  amber: "border-t-amber-500",
  red: "border-t-rose-500",
  violet: "border-t-violet-500",
  cyan: "border-t-cyan-500",
  orange: "border-t-orange-500",
  pink: "border-t-pink-500",
};

const STATUS_OPTIONS = TASK_BOARD_COLUMNS.map((status) => ({
  value: status,
  label: TASK_STATUS_META[status].label,
}));

/**
 * 任务看板（原生 HTML5 拖拽 + Server Action 改状态）
 * - 卡片内的「状态下拉 + 移动」表单是拖拽之外的兜底交互
 * - 只有拥有对应维度写权限的任务可拖动 / 改状态
 */
export function TaskBoard({
  tasks,
  returnTo,
  writableDimensions,
  today,
}: {
  tasks: TaskWithMeta[];
  returnTo: string;
  writableDimensions: Dimension[];
  today: string;
}) {
  const { t, locale } = useI18n();
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);

  const columns = useMemo(
    () =>
      TASK_BOARD_COLUMNS.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status);
        return {
          status,
          meta: TASK_STATUS_META[status],
          tasks: columnTasks,
          estimate: columnTasks.reduce((sum, task) => sum + Number(task.estimate_days ?? 0), 0),
        };
      }),
    [tasks],
  );

  const canWrite = (task: TaskWithMeta) => writableDimensions.includes(task.dimension);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, status: TaskStatus) => {
    event.preventDefault();
    setOverColumn(null);
    setDraggingId(null);
    const taskId = Number(event.dataTransfer.getData("text/plain"));
    if (!taskId) return;
    const form = document.querySelector<HTMLFormElement>(`form[data-task-form="${taskId}"]`);
    if (!form) return;
    const statusField = form.querySelector<HTMLSelectElement>('select[name="status"]');
    if (!statusField) return;
    if (statusField.value === status) return; // 同列拖放无需更新
    statusField.value = status;
    form.requestSubmit();
  };

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-full items-stretch gap-3">
        {columns.map((column) => (
          <div
            key={column.status}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              if (overColumn !== column.status) setOverColumn(column.status);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOverColumn(null);
            }}
            onDrop={(event) => handleDrop(event, column.status)}
            className={cn(
              "flex w-[276px] shrink-0 flex-col rounded-xl border border-t-2 border-border bg-muted/25 transition-colors",
              TONE_BORDER[column.meta.tone],
              overColumn === column.status && "border-primary/40 bg-primary/[0.04] ring-2 ring-primary/20",
            )}
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <StatusBadge kind="task" value={column.status} />
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                {column.tasks.length}
              </span>
              <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                {formatDays(column.estimate, locale)}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-2 p-2">
              {column.tasks.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border px-2 py-8 text-[11px] text-muted-foreground">
                   {t("No tasks · Drop a card here")} </div>
              ) : (
                column.tasks.map((task) => {
                  const writable = canWrite(task);
                  const overdue =
                    task.due_date !== null &&
                    task.due_date < today &&
                    task.status !== "done" &&
                    task.status !== "blocked";
                  return (
                    <div
                      key={task.id}
                      draggable={writable}
                      onDragStart={(event) => {
                        if (!writable) return;
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", String(task.id));
                        setDraggingId(task.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setOverColumn(null);
                      }}
                      className={cn(
                        "group rounded-lg border border-border bg-card p-2.5 shadow-sm transition",
                        writable && "cursor-grab hover:border-primary/30 active:cursor-grabbing",
                        draggingId === task.id && "opacity-40",
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-muted-foreground">{task.key}</span>
                        <StatusBadge kind="dimension" value={task.dimension} />
                        {writable ? (
                          <GripVertical className="ml-auto size-3.5 text-muted-foreground/40 group-hover:text-muted-foreground" />
                        ) : null}
                      </div>

                      <Link
                        href={`/tasks/${task.id}`}
                        className="mt-1.5 block text-xs font-medium leading-5 text-foreground transition-colors hover:text-primary"
                        title={task.title}
                      >
                        {truncate(task.title, 48)}
                      </Link>

                      {task.requirement_key ? (
                        <Link
                          href={`/requirements/${task.requirement_id}`}
                          className="mt-1 inline-flex max-w-full items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:text-primary"
                          title={task.requirement_title ?? task.requirement_key}
                        >
                          {task.requirement_key}
                        </Link>
                      ) : null}

                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        {task.assignee_name ? (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <Avatar name={task.assignee_name} color={task.assignee_color} size="xs" />
                            <span className="truncate">{task.assignee_name}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <UserRound className="size-3" />
                             {t("Unassigned")} </span>
                        )}
                        <span
                          className={cn(
                            "ml-auto inline-flex items-center gap-1 tabular-nums",
                            overdue && "font-medium text-rose-600 dark:text-rose-300",
                          )}
                          title={overdue ? t("Overdue") : t("Due date")}
                        >
                          <CalendarClock className="size-3" />
                          {formatDate(task.due_date, locale)}
                        </span>
                      </div>

                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="tabular-nums">
                           {t("Estimate")} <span className="font-medium text-foreground">{task.estimate_days}</span>  {t("/ Actual")}{" "}
                          <span className="font-medium text-foreground">{task.actual_days}</span>  {t("person-days")} </span>
                      </div>

                      {writable ? (
                        <form
                          action={updateTaskStatusAction}
                          data-task-form={task.id}
                          className="mt-2 flex items-center gap-1 border-t border-border pt-2"
                        >
                          <input type="hidden" name="task_id" value={task.id} />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <select
                            name="status"
                            defaultValue={task.status}
                            aria-label={t("Status for {key}", { key: task.key })}
                            className="h-6 min-w-0 flex-1 cursor-pointer rounded-md border border-input bg-card px-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring/40"
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {t(option.label)}
                              </option>
                            ))}
                          </select>
                          <Button type="submit" size="xs" variant="secondary" className="h-6 px-2 text-[10px]">
                             {t("Move")} </Button>
                        </form>
                      ) : (
                        <div className="mt-2 border-t border-border pt-2 text-[10px] text-muted-foreground/80">
                          {t("{dimension} dimension · Read only", { dimension: t(DIMENSION_META[task.dimension].label) })} </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
