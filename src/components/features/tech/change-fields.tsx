import { createTranslator, type Locale } from "@/lib/i18n";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { CHANGE_TYPE_META, RISK_META, metaOptions } from "@/lib/constants";
import type { Requirement } from "@/lib/types";

export function ChangeFields({ requirements, requirementId, locale }: { requirements: Pick<Requirement, "id" | "key" | "title">[]; requirementId?: number; locale: Locale }) {
  const t = createTranslator(locale);
  return <div className="grid gap-4 md:grid-cols-2">
    <Field label={t("Title")} required className="md:col-span-2"><Input name="title" required maxLength={200} /></Field>
    <Field label={t("Requirement")} required className="md:col-span-2"><Select name="requirement_id" required defaultValue={requirementId ?? ""}><option value="">{t("Select a requirement")}</option>{requirements.map(r => <option key={r.id} value={r.id}>{r.key} · {r.title}</option>)}</Select></Field>
    <Field label={t("Change type")}><Select name="change_type" defaultValue="func_change">{metaOptions(CHANGE_TYPE_META).map(x => <option key={x.value} value={x.value}>{t(x.label)}</option>)}</Select></Field>
    <Field label={t("Risk")}><Select name="risk_level" defaultValue="medium">{metaOptions(RISK_META).map(x => <option key={x.value} value={x.value}>{t(x.label)}</option>)}</Select></Field>
    <Field label={t("Affected files")}><Input name="affected_files" type="number" min={0} step={1} defaultValue={0} required /></Field>
    <Field label={t("Added lines")}><Input name="added_lines" type="number" min={0} step={1} defaultValue={0} required /></Field>
    <Field label={t("Removed lines")}><Input name="removed_lines" type="number" min={0} step={1} defaultValue={0} required /></Field>
    <Field label={t("Reason")} required className="md:col-span-2"><Textarea name="reason" required maxLength={2000} /></Field>
    <Field label={t("Change description (Markdown)")} required className="md:col-span-2"><Textarea name="description_md" required maxLength={20000} rows={7} /></Field>
  </div>;
}
