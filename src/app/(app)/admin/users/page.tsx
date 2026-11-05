import { getI18n } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/auth";
import { listManagedUsers, getAdminUserStats } from "@/lib/queries/admin";
import { PageHeader, SectionCard, Table, TableWrap, THead, TBody, Tr, Th, Td, Select, Button, ActionBanner, readActionMessages } from "@/components/ui";
import { ROLE_META, metaOptions } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { updateUserAction } from "./actions";

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  await requirePermission("admin.users");
  const stats = getAdminUserStats();
  return <div><PageHeader title={t("User management")} description={t("{total} users · {active} active · {inactive} disabled", { total: stats.total, active: stats.active, inactive: stats.inactive })} /><ActionBanner {...readActionMessages(await searchParams)} /><SectionCard title={t("Accounts")}><TableWrap><Table><THead><Tr><Th>{t("User")}</Th><Th>{t("Last login")}</Th><Th>{t("Role and access")}</Th></Tr></THead><TBody>{listManagedUsers().map(user => <Tr key={user.id}><Td><p className="font-medium">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></Td><Td>{formatDateTime(user.last_login_at, locale)}</Td><Td><form action={updateUserAction} className="flex flex-wrap items-center gap-2"><input type="hidden" name="id" value={user.id} /><Select name="role" defaultValue={user.role} aria-label={t("Role for {email}", { email: user.email })} className="w-28">{metaOptions(ROLE_META).map(role => <option key={role.value} value={role.value}>{t(role.label)}</option>)}</Select><label className="flex items-center gap-2 text-xs"><input type="checkbox" name="active" value="1" defaultChecked={Boolean(user.active)} />{t("Active")}</label><Button type="submit" size="sm">{t("Save")}</Button></form></Td></Tr>)}</TBody></Table></TableWrap></SectionCard></div>;
}
