import type { AiProviderPort } from "@/domain/ports";
import { logger } from "@/infrastructure/logging/logger";

/**
 * Null provider — deterministic path always available.
 */
export class NoopAiProvider implements AiProviderPort {
  isAvailable(): boolean {
    return false;
  }

  async complete(): Promise<{ text: string; model: string }> {
    throw new Error("No AI provider configured");
  }
}

/**
 * OpenAI-compatible provider (OpenAI, xAI Grok, OpenRouter, Vercel AI Gateway, etc.).
 * Configure via:
 *   AI_API_KEY
 *   AI_BASE_URL (default https://api.openai.com/v1)
 *   AI_MODEL (default gpt-4o-mini)
 */
export class OpenAiCompatibleProvider implements AiProviderPort {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string
  ) {}

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(input: {
    system: string;
    prompt: string;
    temperature?: number;
  }): Promise<{ text: string; model: string }> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: input.temperature ?? 0.2,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.prompt },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI provider error ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    return { text, model: data.model ?? this.model };
  }
}

export function createAiProvider(): AiProviderPort {
  const apiKey = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    logger.info("AI provider unavailable — using deterministic rules engine");
    return new NoopAiProvider();
  }
  const baseUrl =
    process.env.AI_BASE_URL ??
    process.env.OPENAI_BASE_URL ??
    "https://api.openai.com/v1";
  const model = process.env.AI_MODEL ?? "gpt-4o-mini";
  logger.info("AI provider configured", { baseUrl, model });
  return new OpenAiCompatibleProvider(apiKey, baseUrl, model);
}
