/**
 * LLM 客户端（DeepSeek / 任意 OpenAI 兼容接口）
 *
 * 关键约定：未配置 API Key 时所有调用方必须优雅降级（返回本地规则结果），
 * 不允许因为缺少 Key 让页面或动作失败。
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type LlmResult =
  | { ok: true; content: string; model: string }
  | { ok: false; error: string; reason: "not_configured" | "request_failed" | "empty_response" };

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function getLlmConfig(): LlmConfig | null {
  const deepseek = Boolean(process.env.DEEPSEEK_API_KEY);
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || "";
  if (!apiKey) return null;
  const baseUrl = (deepseek
    ? process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"
    : process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = deepseek
    ? process.env.DEEPSEEK_MODEL || "deepseek-chat"
    : process.env.OPENAI_MODEL || "gpt-4.1-mini";
  return { apiKey, baseUrl, model };
}

export function isLlmConfigured(): boolean {
  return getLlmConfig() !== null;
}

export function getLlmStatus(): { configured: boolean; model: string; baseUrl: string } {
  const config = getLlmConfig();
  return {
    configured: Boolean(config),
    model: config?.model ?? "未配置",
    baseUrl: config?.baseUrl ?? "—",
  };
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number; timeoutMs?: number } = {},
): Promise<LlmResult> {
  const config = getLlmConfig();
  if (!config) {
    return { ok: false, reason: "not_configured", error: "未配置 DEEPSEEK_API_KEY，已降级为本地检索/规则结果" };
  }

  const { temperature = 0.3, maxTokens = 1400, timeoutMs = 45_000 } = options;

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return {
        ok: false,
        reason: "request_failed",
        error: `Model request failed (HTTP ${response.status}). Local results remain available.`,
      };
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      model?: string;
    };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      return { ok: false, reason: "empty_response", error: "模型返回了空内容" };
    }
    return { ok: true, content, model: data.model ?? config.model };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: "request_failed", error: `模型调用失败：${message}` };
  }
}

/** 从模型输出中尽力解析 JSON（容忍 ```json 代码块与前后说明文字） */
export function tryParseJson<T>(text: string): T | null {
  const trimmed = text.trim();
  const candidates: string[] = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");
  const start = firstBrace === -1 ? firstBracket : firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket);
  if (start >= 0) {
    const lastBrace = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
    if (lastBrace > start) candidates.push(trimmed.slice(start, lastBrace + 1));
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // try next
    }
  }
  return null;
}
