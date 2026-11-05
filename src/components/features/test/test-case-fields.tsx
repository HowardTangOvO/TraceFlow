import { createTranslator, type Locale } from "@/lib/i18n";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { ROLE_META, PRIORITY_META, TEST_CASE_STATUS_META, TEST_CASE_TYPE_META, metaOptions } from "@/lib/constants";
import type { Priority, PublicUser, TestCaseStatus, TestCaseType } from "@/lib/types";
export interface TestCaseFormValues {
    title?: string;
    type?: TestCaseType;
    priority?: Priority;
    status?: TestCaseStatus;
    automated?: number;
    owner_id?: number | null;
    precondition_md?: string;
    steps_md?: string;
    expected_md?: string;
}
/** Shared fields keep creation and editing aligned with the same server-side validation. */
export function TestCaseFormFields({ locale, users, values = {}, idPrefix = "tc", }: {
    locale: Locale;
    users: PublicUser[];
    values?: TestCaseFormValues;
    idPrefix?: string;
}) {
    const t = createTranslator(locale);
    return (<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label={t("Case title")} htmlFor={`${idPrefix}-title`} required className="sm:col-span-2">
        <Input id={`${idPrefix}-title`} name="title" defaultValue={values.title ?? ""} placeholder={t("Example: insufficient stock prevents checkout")} maxLength={200} required/>
      </Field>

      <Field label={t("Case type")} htmlFor={`${idPrefix}-type`}>
        <Select id={`${idPrefix}-type`} name="type" defaultValue={values.type ?? "functional"}>
          {metaOptions(TEST_CASE_TYPE_META).map((option) => (<option key={option.value} value={option.value}>
              {t(option.label)}
            </option>))}
        </Select>
      </Field>

      <Field label={t("Priority")} htmlFor={`${idPrefix}-priority`}>
        <Select id={`${idPrefix}-priority`} name="priority" defaultValue={values.priority ?? "P2"}>
          {metaOptions(PRIORITY_META).map((option) => (<option key={option.value} value={option.value}>
              {t(option.label)}
            </option>))}
        </Select>
      </Field>

      <Field label={t("Status")} htmlFor={`${idPrefix}-status`}>
        <Select id={`${idPrefix}-status`} name="status" defaultValue={values.status ?? "active"}>
          {metaOptions(TEST_CASE_STATUS_META).map((option) => (<option key={option.value} value={option.value}>
              {t(option.label)}
            </option>))}
        </Select>
      </Field>

      <Field label={t("Owner")} htmlFor={`${idPrefix}-owner`} hint={t("Assign an active owner")}>
        <Select id={`${idPrefix}-owner`} name="owner_id" defaultValue={values.owner_id ? String(values.owner_id) : ""}>
          <option value="">{t("Unassigned")}</option>
          {users.map((user) => (<option key={user.id} value={user.id}>
              {user.name} ({t(ROLE_META[user.role].label)})
            </option>))}
        </Select>
      </Field>

      <div className="flex items-end pb-2 sm:col-span-2">
        <Checkbox name="automated" label={t("Automated case")} defaultChecked={values.automated === 1}/>
      </div>

      <Field label={t("Preconditions (Markdown)")} htmlFor={`${idPrefix}-precondition`} className="sm:col-span-2" hint={t("Environment, account and data setup")}>
        <Textarea id={`${idPrefix}-precondition`} name="precondition_md" rows={3} defaultValue={values.precondition_md ?? ""} placeholder={t("Example: a signed-in buyer has two in-stock items in the cart.")}/>
      </Field>

      <Field label={t("Test steps (Markdown)")} htmlFor={`${idPrefix}-steps`} className="sm:col-span-2" hint={t("Use a numbered list with one action per step")}>
        <Textarea id={`${idPrefix}-steps`} name="steps_md" required rows={5} defaultValue={values.steps_md ?? ""} placeholder={t("1. Open checkout\n2. Submit the order\n3. Complete payment")}/>
      </Field>

      <Field label={t("Expected results (Markdown)")} htmlFor={`${idPrefix}-expected`} className="sm:col-span-2" hint={t("Describe observable outcomes for each check")}>
        <Textarea id={`${idPrefix}-expected`} name="expected_md" required rows={4} defaultValue={values.expected_md ?? ""} placeholder={t("- The order is created\n- Stock is deducted without overselling")}/>
      </Field>
    </div>);
}
