"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/provider";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-500">
        <TriangleAlert className="size-6" />
      </div>
      <h1 className="text-lg font-semibold tracking-tight">{t("Something went wrong")}</h1>
      <p className="mt-1.5 max-w-md text-xs leading-5 text-muted-foreground">
        {t("Try again or return to the project overview.")}
      </p>
      <pre className="mt-3 max-w-lg overflow-x-auto rounded-lg border border-border bg-muted/60 px-3 py-2 text-left font-mono text-[11px] text-muted-foreground">
        {t(error.message)}
        {error.digest ? `\n(digest: ${error.digest})` : ""}
      </pre>
      <div className="mt-5 flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={reset}>
          <RotateCcw className="size-3.5" />
          {t("Try again")}
        </Button>
        <Link href="/dashboard" className={buttonStyles({ variant: "secondary", size: "sm" })}>
          {t("Back to dashboard")}
        </Link>
      </div>
    </div>
  );
}
