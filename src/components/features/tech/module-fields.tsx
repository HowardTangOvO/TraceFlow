import { createTranslator, type Locale } from "@/lib/i18n";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { CODE_LAYER_META, RISK_META, metaOptions } from "@/lib/constants";
import type { CodeModule, PublicUser } from "@/lib/types";

export function ModuleFields({ module, users, locale }: { module?: CodeModule; users: PublicUser[]; locale: Locale }) {
  const t = createTranslator(locale);
  return <div className="grid gap-4 md:grid-cols-2">
    <Field label={t("Module name")} required><Input name="name" defaultValue={module?.name} required maxLength={200} /></Field>
    <Field label={t("Repository path")} required><Input name="path" defaultValue={module?.path} required maxLength={500} /></Field>
    <Field label={t("Language")}><Input name="language" defaultValue={module?.language ?? "TypeScript"} required maxLength={60} /></Field>
    <Field label={t("Layer")}><Select name="layer" defaultValue={module?.layer ?? "backend"}>{metaOptions(CODE_LAYER_META).map(x => <option key={x.value} value={x.value}>{t(x.label)}</option>)}</Select></Field>
    <Field label={t("Risk")}><Select name="risk" defaultValue={module?.risk ?? "medium"}>{metaOptions(RISK_META).map(x => <option key={x.value} value={x.value}>{t(x.label)}</option>)}</Select></Field>
    <Field label={t("Owner")}><Select name="owner_id" defaultValue={module?.owner_id ?? ""}><option value="">{t("Unassigned")}</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
    <Field label={t("Lines of code")}><Input name="loc" type="number" min={0} step={1} defaultValue={module?.loc ?? 0} required /></Field>
    <Field label={t("Description")} className="md:col-span-2"><Textarea name="description_md" defaultValue={module?.description_md} rows={6} /></Field>
  </div>;
}
