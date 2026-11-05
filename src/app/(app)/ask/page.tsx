import { getI18n } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/auth";
import { getKnowledgeStats } from "@/lib/retrieval";
import { isLlmConfigured } from "@/lib/llm";
import { PageHeader, Alert } from "@/components/ui";
import { AskPanel } from "@/components/features/kb/ask-panel";

export default async function AskPage() {
  const { t, locale } = await getI18n();
  await requirePermission("ai.ask");
  const stats = getKnowledgeStats();
  return <div className="space-y-5"><PageHeader title={t("Knowledge Q&A")} description={t("Search {documents} documents, {requirements} requirements, {modules} modules and {tests} test cases with source references.", { documents: stats.documents, requirements: stats.requirements, modules: stats.codeModules, tests: stats.testCases })} /><Alert>{isLlmConfigured() ? t("Answers use the project knowledge base. If the model is unavailable, local search remains available.") : t("Local search is available without a model connection. Answers include source excerpts and links.")}</Alert><AskPanel /></div>;
}
