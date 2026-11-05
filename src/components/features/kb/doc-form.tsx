import { createTranslator, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import Link from "next/link";
import { Save, X } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { DOC_CATEGORY_META, DOC_STATUS_META, metaOptions } from "@/lib/constants";
import type { DocRelationOption } from "@/lib/queries/docs";
import type { DocCategory, DocStatus } from "@/lib/types";

export interface DocFormDefaults {
  title: string;
  slug: string;
  category: DocCategory;
  status: DocStatus;
  summary: string;
  content_md: string;
  related_requirement_id: number | null;
  related_code_module_id: number | null;
}

export const EMPTY_DOC_FORM: DocFormDefaults = {
  title: "",
  slug: "",
  category: "knowledge",
  status: "published",
  summary: "",
  content_md: "",
  related_requirement_id: null,
  related_code_module_id: null,
};

/** Share the same fields between create and edit so validation stays consistent. */
export function DocForm({
  action,
  defaults,
  requirements,
  codeModules,
  submitLabel,
  cancelHref,
  originalSlug,
  version,
  locale = DEFAULT_LOCALE,
}: {
  action: (formData: FormData) => Promise<void>;
  defaults: DocFormDefaults;
  requirements: DocRelationOption[];
  codeModules: DocRelationOption[];
  submitLabel: string;
  cancelHref: string;
  /** Identify the document even when its slug changes. */
  originalSlug?: string;
  version?: number;
  locale?: Locale;
}) {
  const t = createTranslator(locale);
  return (
    <form action={action} className="space-y-4">
      {originalSlug ? <input type="hidden" name="original_slug" value={originalSlug} /> : null}
      {version !== undefined ? <input type="hidden" name="version" value={version} /> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label={t("Document title")} htmlFor="doc-title" required className="md:col-span-2">
          <Input
            id="doc-title"
            name="title"
            defaultValue={defaults.title}
            placeholder={t("Order timeout requirements")}
            maxLength={120}
            required
            autoComplete="off"
          />
        </Field>
        <Field
          label={t("Slug")}
          htmlFor="doc-slug"
          hint={
            originalSlug
              ? t("Leave blank to keep the current slug. Changing it changes the document URL.")
              : t("Leave blank to generate a slug, or use lowercase letters, numbers and hyphens.")
          }
        >
          <Input
            id="doc-slug"
            name="slug"
            defaultValue={defaults.slug}
            placeholder="order-timeout-prd"
            maxLength={120}
            autoComplete="off"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={t("Category")} htmlFor="doc-category">
          <Select id="doc-category" name="category" defaultValue={defaults.category}>
            {metaOptions(DOC_CATEGORY_META).map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Status")} htmlFor="doc-status">
          <Select id="doc-status" name="status" defaultValue={defaults.status}>
            {metaOptions(DOC_STATUS_META).map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Summary")} htmlFor="doc-summary" hint={t("A short description for the document list.")}>
          <Input
            id="doc-summary"
            name="summary"
            defaultValue={defaults.summary}
            placeholder={t("Describe this document")}
            maxLength={300}
            autoComplete="off"
          />
        </Field>
      </div>

      <Field
        label={t("Content (Markdown)")}
        htmlFor="doc-content"
        hint={t("Supports headings, lists, tables and code blocks.")}
      >
        <Textarea
          id="doc-content"
          name="content_md"
          defaultValue={defaults.content_md}
          required
          maxLength={100000}
          rows={20}
          className="min-h-[420px] font-mono text-xs leading-6"
          placeholder={t("# Document title\n\n## Background\n…\n\n## Decision\n…")}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("Related requirement")} htmlFor="doc-requirement" hint={t("Link this document to a requirement.")}>
          <Select
            id="doc-requirement"
            name="related_requirement_id"
            defaultValue={defaults.related_requirement_id ? String(defaults.related_requirement_id) : ""}
          >
            <option value="">{t("None")}</option>
            {requirements.map((requirement) => (
              <option key={requirement.id} value={String(requirement.id)}>
                {requirement.key} {t("·")}{requirement.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Related code module")} htmlFor="doc-code-module" hint={t("Link this document to a code module.")}>
          <Select
            id="doc-code-module"
            name="related_code_module_id"
            defaultValue={defaults.related_code_module_id ? String(defaults.related_code_module_id) : ""}
          >
            <option value="">{t("None")}</option>
            {codeModules.map((module) => (
              <option key={module.id} value={String(module.id)}>
                {module.key} {t("·")}{module.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-4">
        <Button type="submit" variant="primary" size="sm">
          <Save className="size-3.5" />
          {submitLabel}
        </Button>
        <Link href={cancelHref} className={buttonStyles({ variant: "ghost", size: "sm" })}>
          <X className="size-3.5" />
          {t("Cancel")}</Link>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {t("Changes are recorded in the audit log.")}</span>
      </div>
    </form>
  );
}
