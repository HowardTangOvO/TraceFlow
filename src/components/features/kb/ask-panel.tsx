"use client";

import { useI18n } from "@/components/i18n/provider";
import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Field, Markdown, SectionCard, Textarea } from "@/components/ui";
import type { AskResult } from "@/lib/retrieval";

export function AskPanel() {
  const { t } = useI18n();
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function ask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question }), signal: AbortSignal.timeout(60000) });
      if (response.redirected) throw new Error("Your session expired. Sign in again.");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to answer this question.");
      setResult(data as AskResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed.");
    } finally {
      setPending(false);
    }
  }
  return <div className="space-y-4"><SectionCard title={t("Ask about this project")}><form onSubmit={ask} className="space-y-3"><Field label={t("Question")} htmlFor="question"><Textarea id="question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={2000} required placeholder={t("Which modules and tests are affected by CR-002?")} /></Field><Button type="submit" variant="primary" disabled={pending || !question.trim()}>{t(pending ? "Searching…" : "Ask")}</Button></form></SectionCard><div aria-live="polite" aria-busy={pending}>{error && <Alert tone="red">{t(error)}</Alert>}{result && <div className="space-y-4"><SectionCard title={result.mode === "llm" ? t("Answer · {model}", { model: result.model ?? "" }) : t("Local search results")}><Markdown content={result.answer} /></SectionCard><SectionCard title={t("Sources")}><ol className="space-y-3 text-xs">{result.citations.map((citation, index) => <li key={`${citation.type}-${citation.url}`}><Link href={citation.url} className="font-medium text-primary">{t("[")}{index + 1}{t("]")}{citation.title}</Link><p className="mt-1 text-muted-foreground">{citation.summary}</p></li>)}</ol>{!result.citations.length && <p className="text-xs text-muted-foreground">{t("No matching sources. Try a requirement or change identifier.")}</p>}</SectionCard></div>}</div></div>;
}
