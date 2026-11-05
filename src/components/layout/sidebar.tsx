"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Sparkles, X } from "lucide-react";
import { NAV_SECTIONS } from "@/lib/nav";
import type { Viewer } from "@/lib/viewer";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n/provider";
import { PRODUCT_NAME } from "@/lib/i18n";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname, role, onNavigate }: { pathname: string; role: Viewer["role"]; onNavigate?: () => void }) {
  const { t } = useI18n();
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.filter((section) => !section.adminOnly || role === "admin").map((section) => (
        <div key={section.title}>
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            {t(section.title)}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={item.description ? t(item.description) : undefined}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-sidebar-foreground/75 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {active ? (
                      <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                    ) : null}
                    <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground/80")} />
                    {t(item.label)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function BrandMark() {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/20">
        <Sparkles className="size-4" />
      </div>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[13px] font-semibold tracking-tight text-foreground">{PRODUCT_NAME}</div>
        <div className="truncate text-[10px] text-muted-foreground" title={t("Development Lifecycle Traceability Platform")}>{t("Development Lifecycle Traceability Platform")}</div>
      </div>
    </div>
  );
}

function ProjectChip() {
  const { t } = useI18n();
  return (
    <div className="mx-3 mt-3 rounded-lg border border-border bg-card/70 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-medium text-muted-foreground">SHOP</span>
        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 dark:text-emerald-300">
          {t("In progress")}
        </span>
      </div>
      <div className="mt-0.5 truncate text-xs font-medium text-foreground">星云电商交易平台</div>
    </div>
  );
}

function ViewerFooter({ viewer }: { viewer: Viewer }) {
  const { t } = useI18n();
  return (
    <div className="border-t border-border px-3 py-3">
      <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
        <Avatar name={viewer.name} color={viewer.avatar_color} size="sm" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-xs font-medium text-foreground">{viewer.name}</div>
          <div className="truncate text-[10px] text-muted-foreground">{viewer.title}</div>
        </div>
        <StatusBadge kind="role" value={viewer.role} />
      </div>
      <Link
        href="/ask"
        className="mt-2 flex items-center gap-2 rounded-lg border border-primary/20 bg-gradient-to-br from-primary/10 to-violet-500/10 px-2.5 py-2 text-[11px] font-medium text-primary transition-colors hover:border-primary/40"
      >
        <Sparkles className="size-3.5" />
        {t("AI knowledge Q&A")}
        <span className="ml-auto text-[10px] text-muted-foreground">⌘K</span>
      </Link>
    </div>
  );
}

/** 桌面端固定侧边栏 */
export function Sidebar({ viewer }: { viewer: Viewer }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-border bg-sidebar lg:flex">
      <div className="border-b border-border px-4 py-4">
        <BrandMark />
      </div>
      <ProjectChip />
      <NavLinks pathname={pathname} role={viewer.role} />
      <ViewerFooter viewer={viewer} />
    </aside>
  );
}

/** 移动端抽屉导航 */
export function MobileNav({ viewer }: { viewer: Viewer }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("Open navigation")}
        className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
      >
        <Menu className="size-4.5" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-border bg-sidebar shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <BrandMark />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("Close navigation")}
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            <ProjectChip />
            <NavLinks pathname={pathname} role={viewer.role} onNavigate={() => setOpen(false)} />
            <ViewerFooter viewer={viewer} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
