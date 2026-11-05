"use client";

import { useFormStatus } from "react-dom";
import { Languages } from "lucide-react";
import { setLocaleAction } from "@/app/locale-actions";
import { useI18n } from "./provider";

function LanguageSelect() {
  const { locale, t } = useI18n();
  const { pending } = useFormStatus();
  return <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
    <Languages className="size-4" aria-hidden="true" />
    <select name="locale" value={locale} aria-label={t("Language")} disabled={pending}
      onChange={event => event.currentTarget.form?.requestSubmit()}
      className="h-8 max-w-28 rounded-md border border-border bg-background px-2 text-xs text-foreground disabled:opacity-50">
      <option value="zh-CN">简体中文</option><option value="en">English</option>
    </select>
    <noscript><button type="submit">{t("Apply")}</button></noscript>
  </label>;
}

export function LanguageSwitcher() {
  return <form action={setLocaleAction}><LanguageSelect /></form>;
}
