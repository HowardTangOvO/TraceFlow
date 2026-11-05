import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { listAuditLogs, getAuditFilterOptions } from "@/lib/queries/admin";
import { PageHeader, SectionCard, TableWrap, Table, THead, TBody, Tr, Th, Td, TableEmpty, FilterBar, SearchInput, SelectFilter, Button, buttonStyles } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  await requirePermission("admin.audit");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const action = typeof params.action === "string" ? params.action : "";
  const entity = typeof params.entity === "string" ? params.entity : "";
  const requestedPage = Number(params.page);
  const logs = listAuditLogs({ q, action, entity, page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1 });
  const options = getAuditFilterOptions();
  const pageHref = (page: number) => `/admin/audit?${new URLSearchParams({ q, action, entity, page: String(page) })}`;
  return <div className="space-y-5"><PageHeader title={t("Audit log")} description={t("{count} recorded operations. Logs include preloaded demonstration events.", { count: logs.total })} /><FilterBar action="/admin/audit"><SearchInput defaultValue={q} placeholder={t("Search audit events")} /><SelectFilter name="action" defaultValue={action} placeholder={t("All actions")} options={options.actions.map(item => ({ value: item.value, label: `${item.value} (${item.count})` }))} /><SelectFilter name="entity" defaultValue={entity} placeholder={t("All entities")} options={options.entities.map(item => ({ value: item.value, label: `${item.value} (${item.count})` }))} /><Button type="submit" size="sm">{t("Filter")}</Button></FilterBar><SectionCard title={t("Operations")}><TableWrap><Table><THead><Tr><Th>{t("When")}</Th><Th>{t("User")}</Th><Th>{t("Action")}</Th><Th>{t("Entity")}</Th><Th>{t("Details")}</Th></Tr></THead><TBody>{logs.rows.map(log => <Tr key={log.id}><Td>{formatDateTime(log.created_at, locale)}</Td><Td>{log.user_name ?? t("System")}</Td><Td>{log.action}</Td><Td>{log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ""}</Td><Td>{log.summary}</Td></Tr>)}{!logs.rows.length && <TableEmpty colSpan={5}>{t("No audit events found.")}</TableEmpty>}</TBody></Table></TableWrap><nav className="mt-4 flex items-center gap-3 text-xs" aria-label={t("Audit pagination")}>{logs.page > 1 && <Link href={pageHref(logs.page - 1)} className={buttonStyles({ size: "sm" })}>{t("Previous")}</Link>}<span>{t("Page {page} of {total}", { page: logs.page, total: logs.totalPages })}</span>{logs.page < logs.totalPages && <Link href={pageHref(logs.page + 1)} className={buttonStyles({ size: "sm" })}>{t("Next")}</Link>}</nav></SectionCard></div>;
}
