import { z } from "zod";
import fetch from "node-fetch";
import { buildCommentaryPrompt } from "./prompts/llm_commentary";
import { ENV } from "../config/env";

const CommentarySchema = z.object({
  short: z.string(),
  hint: z.string(),
  tone: z.enum(["encourage", "neutral", "warn"]),
  tags: z.array(z.string()).max(3),
});
export type Commentary = z.infer<typeof CommentarySchema>;

class LlmCommentaryService {
  constructor(
    private apiBase: string,
    private apiKey: string,
    private model: string,
  ) {}

  private async askLLM(prompt: string): Promise<Commentary | null> {
    try {
      const res = await fetch(`${this.apiBase}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.6,
          messages: [
            { role: "system", content: "Ты краткий шахматный ассистент." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" }, // для OpenAI-совместимых
          max_tokens: 180,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`LLM error ${res.status}: ${text}`);
      }

      const data = await res.json() as any;
      const content = data.choices?.[0]?.message?.content || "{}";
      const parsed = CommentarySchema.safeParse(JSON.parse(content));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  async buildCommentary(params: Parameters<typeof buildCommentaryPrompt>[0]): Promise<Commentary> {
    const prompt = buildCommentaryPrompt(params);
    const result = await this.askLLM(prompt);

    if (result) return result;

    // Фолбэк, если LLM недоступна
    const tone = params.severity && ["mistake", "blunder", "inaccuracy"].includes(params.severity)
      ? "warn"
      : (params.severity === "brilliant" || params.severity === "great" ? "encourage" : "neutral");

    const short =
      tone === "warn"
        ? "Ход не самый точный — попробуй защищать ключевые поля и развивать фигуры."
        : tone === "encourage"
        ? "Отличная идея! Ты усилил позицию и сохранил инициативу."
        : "Нормальный ход. Смотри идеи по улучшению развития и безопасности короля.";

    return { short, hint: "", tone, tags: [] };
  }
}

export default new LlmCommentaryService("https://api.openai.com/v1", ENV.llm_api_key, "gpt-4o-mini")