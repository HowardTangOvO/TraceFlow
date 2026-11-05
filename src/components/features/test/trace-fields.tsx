import { createTranslator, type Locale } from "@/lib/i18n";
import { Checkbox, Field } from "@/components/ui";
import { all } from "@/lib/db/client";
export function TraceFields({ locale, projectId, requirementIds = [], moduleIds = [] }: {
    locale: Locale;
    projectId: number;
    requirementIds?: number[];
    moduleIds?: number[];
}) {
    const t = createTranslator(locale);
    const requirements = all<{
        id: number;
        key: string;
        title: string;
    }>("SELECT id,key,title FROM requirements WHERE project_id = ? ORDER BY key", projectId);
    const modules = all<{
        id: number;
        key: string;
        name: string;
    }>("SELECT id,key,name FROM code_modules WHERE project_id = ? ORDER BY key", projectId);
    return <div className="grid gap-4 md:grid-cols-2">
    <Field label={t("Linked requirements")}><div className="max-h-52 space-y-2 overflow-auto rounded-lg border border-border p-3">{requirements.map(item => <div key={item.id}><Checkbox name="requirement_ids" value={item.id} defaultChecked={requirementIds.includes(item.id)} label={`${item.key} · ${item.title}`}/></div>)}{!requirements.length && <p className="text-xs text-muted-foreground">{t("No requirements available.")}</p>}</div></Field>
    <Field label={t("Covered modules")}><div className="max-h-52 space-y-2 overflow-auto rounded-lg border border-border p-3">{modules.map(item => <div key={item.id}><Checkbox name="code_module_ids" value={item.id} defaultChecked={moduleIds.includes(item.id)} label={`${item.key} · ${item.name}`}/></div>)}{!modules.length && <p className="text-xs text-muted-foreground">{t("No modules available.")}</p>}</div></Field>
  </div>;
}
