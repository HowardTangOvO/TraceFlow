
import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CalendarClock,
  FileText,
  FlaskConical,
  GitPullRequestArrow,
  ListChecks,
  RotateCcw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle, SectionCard } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, UserLabel } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty";
import { ActionBanner } from "@/components/ui/alert";
import { buttonStyles } from "@/components/ui/button";
import { DonutChart, CHART_COLORS } from "@/components/charts";
import { TASK_STATUS_META, DIMENSION_META, type Tone } from "@/lib/constants";
import { getDashboardData, requirementStatusList, type RiskItem } from "@/lib/queries/dashboard";
import { formatDate, percent, timeAgo } from "@/lib/utils";
import type { TaskStatus } from "@/lib/types";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Project overview") };
}

const TONE_COLOR: Record<string, string> = {
  gray: CHART_COLORS.slate,
  blue: CHART_COLORS.blue,
  green: CHART_COLORS.emerald,
  amber: CHART_COLORS.amber,
  red: CHART_COLORS.rose,
  violet: CHART_COLORS.violet,
  cyan: CHART_COLORS.cyan,
  orange: CHART_COLORS.orange,
  pink: CHART_COLORS.rose,
};
const toneColor = (tone: Tone) => TONE_COLOR[tone] ?? CHART_COLORS.primary;

const RISK_ICON = {
  amber: "text-amber-500",
  red: "text-rose-500",
  violet: "text-violet-500",
} as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t, locale } = await getI18n();
  const data = getDashboardData();
  const params = await searchParams;
  const denied = typeof params.denied === "string" ? params.denied : undefined;

  const taskDoneRate = percent(data.task.done, data.task.total);
  const activeRequirements = data.requirement.active + data.requirement.changed;
  const statusSegments = data.task.byStatus
    .map((item) => ({
      label: t(TASK_STATUS_META[item.status as TaskStatus]?.label ?? item.status),
      value: item.count,
      color: toneColor(TASK_STATUS_META[item.status as TaskStatus]?.tone ?? "gray"),
    }))
    .filter((item) => item.value > 0);

  const planPassRate = (() => {
    const completed = data.plans.filter((plan) => plan.status === "completed" || plan.status === "running");
    if (!completed.length) return 0;
    const total = completed.reduce((sum, plan) => sum + plan.executed_cases, 0);
    const passed = completed.reduce((sum, plan) => sum + plan.passed_cases, 0);
    return total > 0 ? Math.round((passed / total) * 100) : 0;
  })();

  const dimensionCards = (["pm", "tech", "test"] as const).map((dimension) => {
    const summary = data.task.byDimension.find((item) => item.dimension === dimension);
    const meta = DIMENSION_META[dimension];
    const doneRate = percent(summary?.done ?? 0, summary?.total ?? 0);
    return { dimension, meta, summary, doneRate };
  });

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        eyebrow={
          <>
            <CalendarClock className="size-3.5" />
            {t("Started {start} · Target {target}", { start: formatDate(data.project.start_date, locale), target: formatDate(data.project.target_date, locale) })}
          </>
        }
        title={t("Project overview")}
        description={data.project.description}
        actions={
          <>
            <Link href="/ask" className={buttonStyles({ variant: "secondary", size: "sm" })}>
              <Sparkles className="size-3.5" />
               {t("Ask AI")} </Link>
            <Link href="/changes" className={buttonStyles({ variant: "primary", size: "sm" })}>
              <GitPullRequestArrow className="size-3.5" />
               {t("Change center")} </Link>
          </>
        }
      />

      <ActionBanner error={denied} />

      {/* 核心指标 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("Requirement progress")}
          value={`${data.requirement.active + data.requirement.changed}/${data.requirement.total}`}
          suffix={t("active")}
          hint={t("Changes {changed} · Drafts {draft}", { changed: data.requirement.changed, draft: data.requirement.draft })}
          icon={<FileText className="size-4" />}
          tone="blue"
          href="/requirements"
        />
        <StatCard
          label={t("Task completion")}
          value={`${taskDoneRate}%`}
          hint={t("In progress {active} · Blocked {blocked} · Overdue {overdue}", { active: data.task.inProgress, blocked: data.task.blocked, overdue: data.task.overdue })}
          icon={<ListChecks className="size-4" />}
          tone={data.task.blocked > 0 ? "amber" : "green"}
          href="/tasks"
        />
        <StatCard
          label={t("Change impact")}
          value={data.change.analyzing + data.change.pendingApproval}
          suffix={t("in progress")}
          hint={t("Pending approval {count} · Estimated effort {days} person-days", { count: data.change.pendingApproval, days: data.change.activeEffortDays })}
          icon={<GitPullRequestArrow className="size-4" />}
          tone={data.change.pendingApproval > 0 ? "violet" : "gray"}
          href="/changes"
        />
        <StatCard
          label={t("Regression pass rate")}
          value={`${planPassRate}%`}
          hint={t("Failed {failed} · Blocked {blocked} · Automated {automated}/{total}", { failed: data.test.fail, blocked: data.test.blocked, automated: data.test.automated, total: data.test.active })}
          icon={<RotateCcw className="size-4" />}
          tone={data.test.fail > 0 ? "red" : "green"}
          href="/regression"
        />
      </div>

      {/* 全链路追溯条 */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5 text-xs">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t("Traceability")}</span>
          <TracePill href="/requirements" icon={<FileText className="size-3.5" />} label={t("Requirements")} value={data.requirement.total} />
          <ArrowRight className="size-3.5 text-border" />
          <TracePill href="/code" icon={<Boxes className="size-3.5" />} label={t("Code modules")} value={data.codeModuleCount} />
          <ArrowRight className="size-3.5 text-border" />
          <TracePill href="/tests" icon={<FlaskConical className="size-3.5" />} label={t("Test cases")} value={data.test.total} />
          <ArrowRight className="size-3.5 text-border" />
          <TracePill href="/regression" icon={<RotateCcw className="size-3.5" />} label={t("Regression plans")} value={data.plans.length} />
          <span className="ml-auto hidden text-[11px] text-muted-foreground sm:block">
             {t("Requirement test coverage")} {data.coverage.requirementCovered}/{data.requirement.total}  {t("· Code coverage")} {data.coverage.codeCovered}/{data.codeModuleCount}
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* 里程碑 */}
        <SectionCard
          className="xl:col-span-2"
          title={t("Milestones and iterations")}
          description={t("Open the task board to inspect detailed progress.")}
          contentClassName="px-5 pb-5"
          actions={
            <Link href="/tasks" className={buttonStyles({ variant: "ghost", size: "xs" })}>
               {t("Task board")} <ArrowRight className="size-3" />
            </Link>
          }
        >
          <ol className="relative space-y-4 border-l border-border pl-5">
            {data.milestones.map((milestone) => (
              <li key={milestone.id} className="relative">
                <span
                  className={`absolute -left-[26px] top-1.5 size-2.5 rounded-full border-2 border-background ${
                    milestone.status === "done"
                      ? "bg-emerald-500"
                      : milestone.status === "at_risk"
                        ? "bg-rose-500"
                        : milestone.status === "in_progress"
                          ? "bg-blue-500"
                          : "bg-slate-300 dark:bg-slate-600"
                  }`}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium text-foreground">{milestone.name}</span>
                  <StatusBadge kind="milestone" value={milestone.status} />
                  <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                     {t("Target")} {formatDate(milestone.target_date, locale)}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{milestone.description}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Progress value={milestone.progress} size="sm" showLabel tone={milestone.status === "at_risk" ? "red" : milestone.status === "done" ? "green" : "blue"} className="max-w-[280px]" />
                </div>
              </li>
            ))}
          </ol>
        </SectionCard>

        {/* 任务分布 */}
        <SectionCard title={t("Task status distribution")} description={t("{count} tasks · Estimated {days} person-days", { count: data.task.total, days: data.task.estimateDays })}>
          {statusSegments.length ? (
            <div className="flex flex-col items-center gap-4">
              <DonutChart
                segments={statusSegments}
                centerValue={`${taskDoneRate}%`}
                centerLabel={t("Completion")}
              />
              <div className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5">
                {statusSegments.map((segment) => (
                  <div key={t(segment.label)} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="size-2 rounded-full" style={{ backgroundColor: segment.color }} />
                    <span className="truncate">{t(segment.label)}</span>
                    <span className="ml-auto tabular-nums font-medium text-foreground">{segment.value}</span>
                  </div>
                ))}
              </div>
              <div className="w-full rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
                 {t("Actual effort")} <span className="font-medium text-foreground">{data.task.actualDays}</span>  {t("person-days / Estimated")}{" "}
                {data.task.estimateDays}  {t("person-days")} </div>
            </div>
          ) : (
            <EmptyState title={t("No tasks yet")} />
          )}
        </SectionCard>
      </div>

      {/* 三维度 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {dimensionCards.map(({ dimension, meta, summary, doneRate }) => (
          <Card key={dimension} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${dimension === "pm" ? "bg-blue-500" : dimension === "tech" ? "bg-emerald-500" : "bg-amber-500"}`} />
                <CardTitle>{t("{dimension} dimension", { dimension: t(meta.label) })}</CardTitle>
              </div>
              <StatusBadge kind="dimension" value={dimension} />
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-semibold tabular-nums">{summary?.done ?? 0}</span>
                <span className="pb-1 text-xs text-muted-foreground">/ {summary?.total ?? 0}  {t("tasks completed")}</span>
                <span className="ml-auto pb-1 text-xs font-medium tabular-nums text-primary">{doneRate}%</span>
              </div>
              <Progress value={doneRate} size="sm" tone={meta.tone} className="mt-2" />
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <div className="rounded-lg bg-muted/60 px-2.5 py-1.5">
                   {t("In progress")} <span className="font-medium text-foreground">{summary?.inProgress ?? 0}</span>
                </div>
                <div className="rounded-lg bg-muted/60 px-2.5 py-1.5">
                   {t("Effort")} <span className="font-medium text-foreground">{summary?.actualDays ?? 0}</span> / {summary?.estimateDays ?? 0}
                </div>
              </div>
              <Link
                href={dimension === "pm" ? "/requirements" : dimension === "tech" ? "/code" : "/tests"}
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                 {t("{dimension} workspace", { dimension: t(meta.label) })} <ArrowRight className="size-3" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* 最近变更 */}
        <SectionCard
          className="xl:col-span-2"
          title={t("Recent changes")}
          description={t("Impact analysis, effort estimates and test change suggestions.")}
          actions={
            <Link href="/changes" className={buttonStyles({ variant: "ghost", size: "xs" })}>
               {t("All changes")} <ArrowRight className="size-3" />
            </Link>
          }
        >
          <div className="divide-y divide-border">
            {data.recentChanges.map((change) => (
              <Link key={change.id} href={`/changes/${change.id}`} className="group flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300">
                  <GitPullRequestArrow className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-xs font-medium text-foreground group-hover:text-primary">{change.title}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="font-mono">{change.key}</span>
                    <StatusBadge kind="change" value={change.status} />
                    <StatusBadge kind="risk" value={change.risk_level} />
                    {change.requirement_key ? (
                      <span className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{change.requirement_key}</span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{t("Impacted modules")} {change.impact_count}</span>
                    <span>{t("Effort estimates")} {change.estimate_count}</span>
                    <span>{t("Test change suggestions")} {change.suggestion_count}</span>
                    <span className="ml-auto">{timeAgo(change.updated_at, locale)}</span>
                  </div>
                </div>
                <ArrowRight className="mt-2 size-3.5 shrink-0 text-muted-foreground/50 transition group-hover:text-primary" />
              </Link>
            ))}
            {data.recentChanges.length === 0 ? <EmptyState title={t("No changes yet")} /> : null}
          </div>
        </SectionCard>

        {/* 风险提醒 */}
        <SectionCard
          title={t("Risks and attention items")}
          description={t("Blocked tasks, failed tests and changes awaiting approval.")}
          actions={<StatusBadge kind="risk" value={data.risks.length > 2 ? "high" : "medium"} />}
        >
          {data.risks.length ? (
            <ul className="space-y-2.5">
              {data.risks.map((risk: RiskItem) => (
                <li key={risk.title}>
                  <Link href={risk.href} className="group flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-2.5 transition-colors hover:border-primary/30 hover:bg-muted/50">
                    <TriangleAlert className={`mt-0.5 size-4 shrink-0 ${RISK_ICON[risk.tone]}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-foreground group-hover:text-primary">{t(risk.title)}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{t(risk.detail)}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t("No outstanding risks")} description={t("All tasks, tests and changes are in a healthy state.")} />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* 最近动态 */}
        <SectionCard className="xl:col-span-2" title={t("Recent activity")} description={t("An audit trail of key operations.")}>
          <ul className="space-y-3">
            {data.activity.map((log) => (
              <li key={log.id} className="flex items-start gap-2.5">
                <Avatar name={log.user_name ?? t("System")} color={log.avatar_color} size="xs" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs leading-5 text-foreground/90">
                    <span className="font-medium">{log.user_name ?? t("System")}</span>
                    <span className="mx-1 text-muted-foreground">{log.summary}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="rounded bg-muted px-1 py-0.5 font-mono">{log.action}</span>
                    <span>{log.entity_type}</span>
                    <span className="ml-auto">{timeAgo(log.created_at, locale)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* 知识库 & 覆盖率 */}
        <SectionCard
          title={t("Knowledge overview")}
          description={t("{count} knowledge documents", { count: data.docCount })}
          actions={
            <Link href="/docs" className={buttonStyles({ variant: "ghost", size: "xs" })}>
               {t("Open")} <ArrowRight className="size-3" />
            </Link>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Link href="/requirements" className="rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:border-primary/30">
                <div className="text-[11px] text-muted-foreground">{t("Requirement coverage")}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {data.coverage.requirementCovered}
                  <span className="text-xs font-normal text-muted-foreground"> / {data.requirement.total}</span>
                </div>
                <Progress
                  value={percent(data.coverage.requirementCovered, data.requirement.total)}
                  size="sm"
                  tone="blue"
                  className="mt-1.5"
                />
              </Link>
              <Link href="/code" className="rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:border-primary/30">
                <div className="text-[11px] text-muted-foreground">{t("Code coverage")}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {data.coverage.codeCovered}
                  <span className="text-xs font-normal text-muted-foreground"> / {data.codeModuleCount}</span>
                </div>
                <Progress
                  value={percent(data.coverage.codeCovered, data.codeModuleCount)}
                  size="sm"
                  tone="green"
                  className="mt-1.5"
                />
              </Link>
            </div>
            <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/8 to-violet-500/8 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" />
                 {t("Try asking AI")} </div>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                 {t("How long is the order timeout, and which test cases are affected?")} </p>
              <Link href="/ask" className={buttonStyles({ variant: "primary", size: "xs", className: "mt-2" })}>
                 {t("Start asking")} <ArrowRight className="size-3" />
              </Link>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-[11px]">
              <span className="text-muted-foreground">{t("Regression plans")}</span>
              <span className="flex items-center gap-1.5">
                {data.plans.slice(0, 3).map((plan) => (
                  <Link key={plan.id} href={`/regression/${plan.id}`} title={plan.title}>
                    <StatusBadge kind="plan" value={plan.status} />
                  </Link>
                ))}
              </span>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function TracePill({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1 transition-colors hover:border-primary/30 hover:bg-muted/70"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </Link>
  );
}
