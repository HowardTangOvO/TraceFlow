import { cookies } from "next/headers";
import { createTranslator, DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "./index";

/** Read locale per request to avoid sharing one visitor's language with another. */
export async function getI18n() {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(value) ? value : DEFAULT_LOCALE;
  return { locale, t: createTranslator(locale) };
}
