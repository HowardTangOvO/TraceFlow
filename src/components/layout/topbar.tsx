import Link from "next/link";
import { Bot, LogOut, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { MobileNav } from "@/components/layout/sidebar";
import { logoutAction } from "@/app/(app)/actions";
import { logAudit } from "@/lib/audit";
import type { User } from "@/lib/types";
import { toViewer } from "@/lib/viewer";
import { getI18n } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { PRODUCT_NAME } from "@/lib/i18n";

/** 顶部栏：移动端导航、快捷入口、主题切换、当前用户 */
export async function Topbar({ user }: { user: User }) {
  const { t } = await getI18n();
  const viewer = toViewer(user);

  async function signOut() {
    "use server";
    await logoutAction();
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur-xl sm:px-6">
      <MobileNav viewer={viewer} />
      <div className="hidden min-w-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
        <span className="font-medium text-foreground">星云电商交易平台</span>
        <span className="text-border">/</span>
        <span className="truncate">{PRODUCT_NAME}</span>
        <span className="ml-1 hidden rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline">
          SHOP
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <LanguageSwitcher />
        <Link
          href="/ask"
          className={buttonStyles({ variant: "ghost", size: "sm", className: "hidden gap-1.5 text-muted-foreground sm:inline-flex" })}
        >
          <Bot className="size-3.5" />
          {t("Knowledge Q&A")}
        </Link>
        <Link
          href="/requirements"
          aria-label={t("Search")}
          className={buttonStyles({ variant: "ghost", size: "icon" })}
        >
          <Search className="size-4" />
        </Link>
        <ThemeToggle />
        <div className="mx-1.5 hidden h-5 w-px bg-border sm:block" />
        <div className="flex items-center gap-2 pl-1">
          <Avatar name={user.name} color={user.avatar_color} size="sm" />
          <div className="hidden leading-tight sm:block">
            <div className="text-xs font-medium text-foreground">{user.name}</div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <StatusBadge kind="role" value={user.role} />
              <span className="truncate">{user.title}</span>
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              title={t("Sign out")}
              aria-label={t("Sign out")}
              className={buttonStyles({ variant: "ghost", size: "icon", className: "size-8" })}
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

/** 记录一次页面访问（供需要审计的页面调用，当前 Topbar 未使用） */
export function recordPageView(user: User, path: string) {
  logAudit(user, "exported", "page", null, `访问 ${path}`);
}
