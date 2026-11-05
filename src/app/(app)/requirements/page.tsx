
import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import {
  Boxes,
  FileText,
  FlaskConical,
  ListChecks,
  Plus,
  SearchX,
} from "lucide-react";
import {
  ActionBanner,
  Button,
  Disclosure,
  EmptyState,
  Field,
  FilterActions,
  FilterBar,
  Input,
  PageHeader,
  Progress,
  SearchInput,
  Select,
  SelectFilter,
  StatCard,
  StatusBadge,
  TabLinks,
  Table,
  TableEmpty,
  TableWrap,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tr,
  UserLabel,
  buttonStyles,
  readActionMessages,
} from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PRIORITY_META, REQUIREMENT_STATUS_META, metaOptions } from "@/lib/constants";
import { getRequirementStatusCounts, listRequirements } from "@/lib/queries/requirements";
import { getUserMap, listUsers } from "@/lib/queries/common";
import { percent, timeAgo } from "@/lib/utils";
import type { Priority, RequirementStatus } from "@/lib/types";
import { createRequirementAction } from "./actions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Requirement management") };
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function RequirementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t, locale } = await getI18n();
  const user = await requireUser();
  const canWrite = can(user, "requirement.write");
  const params = await searchParams;

  const q = firstParam(params.q).trim();
  const statusRaw = firstParam(params.status);
  const priorityRaw = firstParam(params.priority);
  const ownerRaw = Number(firstParam(params.owner));
  const status = Object.hasOwn(REQUIREMENT_STATUS_META, statusRaw) ? (statusRaw as RequirementStatus) : undefined;
  const priority = Object.hasOwn(PRIORITY_META, priorityRaw) ? (priorityRaw as Priority) : undefined;
  const owner = Number.isInteger(ownerRaw) && ownerRaw > 0 ? ownerRaw : undefined;
  const newOpen = firstParam(params.new) === "1";

  const requirements = listRequirements({ status, priority, owner, q: q || undefined });
  const counts = getRequirementStatusCounts();
  const users = listUsers();
  const userMap = getUserMap();

  const withCode = requirements.filter((item) => item.code_count > 0).length;
  const withTest = requirements.filter((item) => item.test_count > 0).length;
  const totalTasks = requirements.reduce((sum, item) => sum + item.task_count, 0);
  const doneTasks = requirements.reduce((sum, item) => sum + item.done_task_count, 0);

  const buildHref = (overrides: Record<string, string | undefined> = {}): string => {
    const merged: Record<string, string | undefined> = {
      status: status ?? "",
      priority: priority ?? "",
      owner: owner ? String(owner) : "",
      q,
      ...overrides,
    };
    const sp = new URLSearchParams();
    for (const key of ["status", "priority", "owner", "q", "new"]) {
      const value = merged[key];
      if (value) sp.set(key, value);
    }
    const query = sp.toString();
    return query ? `/requirements?${query}` : "/requirements";
  };

  const tabItems = [
    { label: t("All"), href: buildHref({ status: "" }), active: !status, count: counts.total },
    ...metaOptions(REQUIREMENT_STATUS_META).map((option) => ({
      label: t(option.label),
      href: buildHref({ status: option.value }),
      active: status === option.value,
      count: counts[option.value],
    })),
  ];

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        eyebrow={
          <>
            <FileText className="size-3.5" />
             {t("Product · Requirements and traceability")} </>
        }
        title={t("Requirement management")}
        description={t("Manage requirements, priorities and owners, with links to tasks, code modules, tests and changes.")}
        actions={
          <>
            <Link href="/tasks" className={buttonStyles({ variant: "secondary", size: "sm" })}>
              <ListChecks className="size-3.5" />
               {t("Task board")} </Link>
            {canWrite ? (
              <Link
                href={`${buildHref({ new: "1" })}#new-requirement`}
                className={buttonStyles({ variant: "primary", size: "sm" })}
              >
                <Plus className="size-3.5" />
                 {t("New requirement")} </Link>
            ) : null}
          </>
        }
      />

      <ActionBanner {...readActionMessages(params)} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("Total requirements")}
          value={counts.total}
          suffix={t("items")}
          hint={t("Drafts {draft} · Active {active} · Changed {changed}", { draft: counts.draft, active: counts.active, changed: counts.changed })}
          icon={<FileText className="size-4" />}
          tone="blue"
        />
        <StatCard
          label={t("Filtered task completion")}
          value={`${percent(doneTasks, totalTasks)}%`}
          hint={t("{done}/{total} tasks completed in the current filter", { done: doneTasks, total: totalTasks })}
          icon={<ListChecks className="size-4" />}
          tone={percent(doneTasks, totalTasks) >= 60 ? "green" : "amber"}
        />
        <StatCard
          label={t("Module link coverage")}
          value={`${percent(withCode, requirements.length)}%`}
          hint={t("{linked}/{total} requirements linked to modules", { linked: withCode, total: requirements.length })}
          icon={<Boxes className="size-4" />}
          tone={percent(withCode, requirements.length) >= 50 ? "cyan" : "amber"}
        />
        <StatCard
          label={t("Test link coverage")}
          value={`${percent(withTest, requirements.length)}%`}
          hint={t("{linked}/{total} requirements linked to test cases", { linked: withTest, total: requirements.length })}
          icon={<FlaskConical className="size-4" />}
          tone={percent(withTest, requirements.length) >= 50 ? "violet" : "amber"}
        />
      </div>

      <div className="space-y-3">
        <TabLinks items={tabItems} />

        <div className="flex flex-wrap items-center gap-3">
          <FilterBar action="/requirements">
            <input type="hidden" name="status" value={status ?? ""} />
            <SearchInput defaultValue={q} placeholder={t("Search key, title, description or source…")} />
            <SelectFilter
              name="priority"
              defaultValue={priority ?? ""}
              placeholder={t("All priorities")}
              options={metaOptions(PRIORITY_META).map(option => ({ ...option, label: t(option.label) }))}
            />
            <SelectFilter
              name="owner"
              defaultValue={owner ? String(owner) : ""}
              placeholder={t("All owners")}
              options={users.map((item) => ({ value: String(item.id), label: item.name }))}
            />
            <FilterActions>
              <Button type="submit" variant="secondary" size="sm">
                 {t("Filter")} </Button>
              <Link href="/requirements" className={buttonStyles({ variant: "ghost", size: "sm" })}>
                 {t("Reset")} </Link>
            </FilterActions>
          </FilterBar>
          <span className="ml-auto text-[11px] text-muted-foreground">
             {t("Total")} <span className="font-medium tabular-nums text-foreground">{requirements.length}</span>  {t("requirements")} </span>
        </div>

        <TableWrap>
          <Table className="min-w-[1100px]">
            <THead>
              <Tr>
                <Th>{t("Key")}</Th>
                <Th>{t("Title")}</Th>
                <Th>{t("Status")}</Th>
                <Th>{t("Priority")}</Th>
                <Th>{t("Owner")}</Th>
                <Th className="text-center">{t("Version")}</Th>
                <Th>{t("Task progress")}</Th>
                <Th className="text-center">{t("Code")}</Th>
                <Th className="text-center">{t("Tests")}</Th>
                <Th className="text-center">{t("Changes")}</Th>
                <Th className="text-right">{t("Updated")}</Th>
              </Tr>
            </THead>
            <TBody>
              {requirements.map((requirement) => {
                const ownerUser = requirement.owner_id ? userMap.get(requirement.owner_id) : undefined;
                return (
                  <Tr key={requirement.id}>
                    <Td>
                      <Link
                        href={`/requirements/${requirement.id}`}
                        className="font-mono text-[11px] text-muted-foreground transition-colors hover:text-primary"
                      >
                        {requirement.key}
                      </Link>
                    </Td>
                    <Td className="max-w-[300px]">
                      <Link
                        href={`/requirements/${requirement.id}`}
                        className="block truncate text-xs font-medium text-foreground transition-colors hover:text-primary"
                        title={requirement.title}
                      >
                        {requirement.title}
                      </Link>
                      <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                        {requirement.source || t("No source recorded")}
                      </span>
                    </Td>
                    <Td>
                      <StatusBadge kind="requirement" value={requirement.status} />
                    </Td>
                    <Td>
                      <StatusBadge kind="priority" value={requirement.priority} />
                    </Td>
                    <Td>
                      <UserLabel name={requirement.owner_name} color={ownerUser?.avatar_color} />
                    </Td>
                    <Td className="text-center">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                        v{requirement.version}
                      </span>
                    </Td>
                    <Td>
                      {requirement.task_count > 0 ? (
                        <div className="flex items-center gap-2">
                          <Progress
                            value={percent(requirement.done_task_count, requirement.task_count)}
                            size="sm"
                            tone={requirement.done_task_count === requirement.task_count ? "green" : "blue"}
                            className="w-20"
                          />
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {requirement.done_task_count}/{requirement.task_count}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </Td>
                    <Td className="text-center">
                      <TraceCount href={`/requirements/${requirement.id}#trace-code`} value={requirement.code_count} />
                    </Td>
                    <Td className="text-center">
                      <TraceCount href={`/requirements/${requirement.id}#trace-test`} value={requirement.test_count} />
                    </Td>
                    <Td className="text-center">
                      <TraceCount href={`/requirements/${requirement.id}#related-changes`} value={requirement.change_count} />
                    </Td>
                    <Td className="text-right text-[11px] text-muted-foreground">{timeAgo(requirement.updated_at, locale)}</Td>
                  </Tr>
                );
              })}
              {requirements.length === 0 ? (
                <TableEmpty colSpan={11}>
                  <EmptyState
                    icon={<SearchX className="size-5" />}
                    title={t("No matching requirements")}
                    description={t("Adjust the filters or create a requirement.")}
                  />
                </TableEmpty>
              ) : null}
            </TBody>
          </Table>
        </TableWrap>
      </div>

      {canWrite ? (
        <div id="new-requirement">
          <Disclosure
            summary={
              <span className="inline-flex items-center gap-1.5">
                <Plus className="size-3.5 text-primary" />
                 {t("New requirement")} <span className="text-[11px] font-normal text-muted-foreground">
                   {t("New requirements receive a generated key and draft status.")} </span>
              </span>
            }
            defaultOpen={newOpen}
            tone="primary"
          >
            <form action={createRequirementAction} className="space-y-3">
              <input type="hidden" name="returnTo" value="/requirements" />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label={t("Requirement title")} htmlFor="new-req-title" required className="md:col-span-3">
                  <Input
                    id="new-req-title"
                    name="title"
                    required
                    maxLength={200}
                    placeholder={t("For example: combined checkout and shipping estimate")}
                  />
                </Field>
                <Field label={t("Priority")} htmlFor="new-req-priority">
                  <Select id="new-req-priority" name="priority" defaultValue="P2">
                    {metaOptions(PRIORITY_META).map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.label)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("Owner")} htmlFor="new-req-owner">
                  <Select id="new-req-owner" name="owner_id" defaultValue={String(user.id)}>
                    <option value="">{t("Unassigned")}</option>
                    {users.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}（{item.title || item.email}）
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("Requirement source")} htmlFor="new-req-source">
                  <Input id="new-req-source" name="source" maxLength={120} placeholder={t("For example: user interviews or data insights")} />
                </Field>
              </div>
              <Field
                label={t("Requirement description (Markdown)")}
                htmlFor="new-req-desc"
                hint={t("Supports Markdown headings, acceptance criteria and lists.")}
              >
                <Textarea
                  id="new-req-desc"
                  name="description_md"
                  rows={6}
                  placeholder={t("## Background\n\n## User story\n\n## Acceptance criteria\n- ")}
                />
              </Field>
              <div className="flex items-center gap-2">
                <Button type="submit" variant="primary" size="sm">
                   {t("Create requirement")} </Button>
                <span className="text-[11px] text-muted-foreground">
                   {t("Changes are recorded in the audit log.")} </span>
              </div>
            </form>
          </Disclosure>
        </div>
      ) : null}
    </div>
  );
}

function TraceCount({ href, value }: { href: string; value: number }) {
  if (!value) return <span className="text-[11px] text-muted-foreground">—</span>;
  return (
    <Link
      href={href}
      className="inline-flex min-w-6 items-center justify-center rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground transition-colors hover:text-primary"
    >
      {value}
    </Link>
  );
}
