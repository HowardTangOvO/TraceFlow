import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
        <Compass className="size-6" />
      </div>
      <p className="font-mono text-xs text-muted-foreground">404</p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">{t("Page not found")}</h1>
      <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
        {t("The page is unavailable or this record has been removed.")}
      </p>
      <div className="mt-5 flex items-center gap-2">
        <Link href="/dashboard" className={buttonStyles({ variant: "primary", size: "sm" })}>
          {t("Back to dashboard")}
        </Link>
        <Link href="/ask" className={buttonStyles({ variant: "secondary", size: "sm" })}>
          {t("Knowledge Q&A")}
        </Link>
      </div>
    </div>
  );
}
