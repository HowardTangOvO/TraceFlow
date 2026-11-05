"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const locale = useContext(LocaleContext);
  return useMemo(() => ({ locale, t: createTranslator(locale) }), [locale]);
}

/** Let shared server/client-compatible primitives render localized interface text. */
export function LocalizedText({ children }: { children: string }) {
  const { t } = useI18n();
  return <>{t(children)}</>;
}
