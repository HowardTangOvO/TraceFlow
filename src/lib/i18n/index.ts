import { commonMessages } from "./messages/common";
import { pmMessages } from "./messages/pm";
import { techMessages } from "./messages/tech";
import { testMessages } from "./messages/test";
import { kbMessages } from "./messages/kb";

export const LOCALES = ["zh-CN", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "zh-CN";
export const LOCALE_COOKIE = "traceflow_locale";
export const PRODUCT_NAME = "TraceFlow";
export const PRODUCT_DESCRIPTION = "研发全链路追溯平台";
export type TranslationValues = Record<string, string | number>;
export type Translator = (key: string, values?: TranslationValues) => string;

const messages: Record<string, string> = { ...commonMessages, ...pmMessages, ...techMessages, ...testMessages, ...kbMessages };
const englishByChinese = new Map(Object.entries(messages).map(([english, chinese]) => [chinese, english]));
const messageTemplates = Object.entries(messages)
  .filter(([key]) => /\{\w+\}/.test(key) && key.replace(/\{\w+\}/g, "").trim().length >= 6)
  .sort(([a], [b]) => b.replace(/\{\w+\}/g, "").length - a.replace(/\{\w+\}/g, "").length)
  .map(([english, chinese]) => {
  const names = [...english.matchAll(/\{(\w+)\}/g)].map(match => match[1]);
  const chineseNames = [...chinese.matchAll(/\{(\w+)\}/g)].map(match => match[1]);
  const compile = (text: string) => new RegExp(`^${text.split(/\{\w+\}/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("([\\s\\S]*?)")}$`);
  return { english, chinese, names, chineseNames, pattern: compile(english), chinesePattern: compile(chinese) };
});

export function isLocale(value: unknown): value is Locale {
  return value === "zh-CN" || value === "en";
}

/** Translate interface messages only; callers must keep stored business content separate. */
export function translate(locale: Locale, key: string, values: TranslationValues = {}): string {
  const english = englishByChinese.get(key) ?? key;
  let template = locale === "zh-CN" && Object.hasOwn(messages, english) ? messages[english] : english;
  let parameters = values;
  if (english === key && !Object.hasOwn(messages, key)) {
    // Validation utilities can produce messages before the request locale is known.
    for (const entry of messageTemplates) {
      const englishMatch = entry.pattern.exec(key);
      const match = englishMatch ?? entry.chinesePattern.exec(key);
      if (!match) continue;
      template = locale === "zh-CN" ? entry.chinese : entry.english;
      const names = englishMatch ? entry.names : entry.chineseNames;
      parameters = Object.fromEntries(names.map((name, index) => [name, name === "field" ? translate(locale, match[index + 1]) : match[index + 1]]));
      break;
    }
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => Object.hasOwn(parameters, name) ? String(parameters[name]) : match);
}

export function createTranslator(locale: Locale): Translator {
  return (key, values) => translate(locale, key, values);
}
