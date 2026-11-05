
import { getI18n } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  GitPullRequestArrow,
  Layers,
  ListChecks,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { Button, buttonStyles } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/status-badge";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { loginAction } from "./actions";

const DEMO_ACCOUNTS = [
  { role: "pm", email: "pm@demo.dev", password: "pm123", name: "林晓", title: "产品经理", desc: "需求 / 排期 / 变更审批" },
  { role: "tech", email: "tech@demo.dev", password: "tech123", name: "陈默", title: "后端负责人", desc: "代码 / 影响分析 / Effort" },
  { role: "test", email: "test@demo.dev", password: "test123", name: "苏晴", title: "测试负责人", desc: "用例 / 回归 / 执行" },
  { role: "admin", email: "admin@demo.dev", password: "admin123", name: "周瑾", title: "平台管理员", desc: "用户 / 权限 / 审计" },
];

const FEATURES = [
  {
    icon: Layers,
    title: "需求 → 代码 → 测试，全程双向追溯",
    description: "每条需求能看到落地的模块、覆盖的用例；每个变更能定位受影响代码与待改用例。",
  },
  {
    icon: GitPullRequestArrow,
    title: "变更影响分析 + Effort 评估",
    description: "规则引擎、历史校准、AI 辅助三路估算，研发确认后进入审批与排期。",
  },
  {
    icon: RotateCcw,
    title: "回归闭环，不再靠记忆",
    description: "基于影响分析自动推荐回归用例，执行结果与通过率实时沉淀。",
  },
  {
    icon: Bot,
    title: "知识库 + AI 问答（无 Key 也可用）",
    description: "PRD、技术方案、测试策略统一沉淀，检索与问答直接给出引用来源。",
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t, locale } = await getI18n();
  const current = await getCurrentUser();
  if (current) redirect("/dashboard");

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const nextPath = typeof params.next === "string" ? params.next : "/dashboard";
  const presetEmail = typeof params.email === "string" ? params.email : "";

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* 左侧品牌区 */}
      <div className="relative hidden overflow-hidden bg-[#0b1020] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.35),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.25),transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 via-violet-400 to-fuchsia-400 shadow-lg shadow-indigo-500/30">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide">{t("TraceFlow")}</div>
              <div className="text-[11px] text-white/50">{t("Development Lifecycle Traceability Platform")}</div>
            </div>
          </div>

          <h1 className="mt-14 max-w-lg text-3xl font-semibold leading-snug tracking-tight text-balance">
             {t("Requirements, code and tests")} <br />
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
               {t("Connected in one traceable workflow")} </span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-white/55">
             {t("A shared knowledge base for product, engineering and testing: understand each change, its impact, effort and required regression coverage.")} </p>

          <ul className="mt-10 space-y-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <li key={t(feature.title)} className="flex gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-indigo-200">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-white/90">{t(feature.title)}</div>
                    <div className="mt-0.5 max-w-sm text-xs leading-5 text-white/45">{t(feature.description)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="relative flex items-center gap-4 text-[11px] text-white/35">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" />  {t("Four roles · Audit trail")} </span>
          <span className="inline-flex items-center gap-1.5">
            <ListChecks className="size-3.5" />  {t("End-to-end traceability · Regression workflow")} </span>
        </div>
      </div>

      {/* 右侧登录区 */}
      <div className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-6 flex justify-end"><LanguageSwitcher /></div>
          <div className="mb-7 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white">
                <Sparkles className="size-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">{t("TraceFlow")}</div>
                <div className="text-[11px] text-muted-foreground">{t("Development Lifecycle Traceability Platform")}</div>
              </div>
            </div>
          </div>

          <div className="mb-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{t("Welcome back")}</div>
          <h2 className="text-2xl font-semibold tracking-tight">{t("Sign in to your workspace")}</h2>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
             {t("Use a demo account to explore the complete workflow from each role.")} </p>

          {error ? (
            <div className="mt-5">
              <Alert tone="red" title={t("Sign-in failed")}>
                {t(error)}
              </Alert>
            </div>
          ) : null}

          <form action={loginAction} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={nextPath} />
            <Field label={t("Email")} htmlFor="email" required>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@demo.dev"
                defaultValue={presetEmail}
              />
            </Field>
            <Field label={t("Password")} htmlFor="password" required>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder={t("Enter your password")}
              />
            </Field>
            <Button type="submit" variant="primary" size="lg" className="w-full">
               {t("Sign in")} <ArrowRight className="size-4" />
            </Button>
          </form>

          <div className="my-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("One-click demo sign-in")}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {DEMO_ACCOUNTS.map((account) => (
              <form key={account.email} action={loginAction}>
                <input type="hidden" name="email" value={account.email} />
                <input type="hidden" name="password" value={account.password} />
                <input type="hidden" name="next" value="/dashboard" />
                <button
                  type="submit"
                  className="group flex w-full flex-col items-start gap-1 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">{account.name}</span>
                    <StatusBadge kind="role" value={account.role} />
                  </span>
                  <span className="text-[10px] text-muted-foreground">{t(account.desc)}</span>
                  <span className="mt-0.5 font-mono text-[10px] text-muted-foreground/70 group-hover:text-primary">
                    {account.email} / {account.password}
                  </span>
                </button>
              </form>
            ))}
          </div>

          <p className="mt-7 text-center text-[10px] leading-5 text-muted-foreground">
             {t("Demo data is stored locally. Knowledge search remains available without a model connection.")} <br />
            <Link href="/login" className="text-primary hover:underline">
               {t("Demo data can be regenerated with pnpm db:reset")} </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
