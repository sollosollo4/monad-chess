import { z } from "zod";
import fetch from "node-fetch";
import { ENV } from "../config/env";

const PuzzleMessageSchema = z.object({
  text: z.string(),
  tone: z.enum(["encourage", "neutral", "warn", "celebrate", "consolate"]),
});
export type PuzzleMessage = z.infer<typeof PuzzleMessageSchema>;

class LlmPuzzleService {
  constructor(
    private apiBase: string,
    private apiKey: string,
    private model: string
  ) {}

  private async askLLM(prompt: string): Promise<PuzzleMessage | null> {
    try {
      const res = await fetch(`${this.apiBase}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.8, // чуть больше креатива, чтобы приветствия и концовки были разнообразнее
          messages: [
            { role: "system", content: "Ты шахматный тренер, который говорит дружелюбно и кратко." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 120,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`LLM error ${res.status}: ${text}`);
      }

      const data = await res.json() as any;
      const content = data.choices?.[0]?.message?.content || "{}";
      const parsed = PuzzleMessageSchema.safeParse(JSON.parse(content));
      return parsed.success ? parsed.data : null;
    } catch (err) {
      return null;
    }
  }

  /** 1. Приветствие игрока при начале паззла */
  async greetPlayer(playerName?: string): Promise<PuzzleMessage> {
    const namePart = playerName ? `Игрок ${playerName}` : "друг";
    const prompt = `Придумай короткое и оригинальное приветствие для ${namePart}, который начинает решать шахматный паззл. 
      Будь дружелюбным. Верни JSON вида { "text": "...", "tone": "encourage" }`;
    return (await this.askLLM(prompt)) ?? { text: "Удачи в этом паззле! 🚀", tone: "encourage" };
  }

  /** 2. Комментарий на каждый ход */
  async moveComment(isCorrect: boolean, move: string, step: number, total: number): Promise<PuzzleMessage> {
    const prompt = isCorrect
      ? `Скажи короткий комментарий к правильному ходу ${move} на шаге ${step+1} из ${total}. 
        Тон — encourage. Верни JSON { "text": "...", "tone": "encourage" }`
      : `Скажи короткий комментарий к ошибочному ходу ${move} на шаге ${step+1} из ${total}. 
        Тон — warn. Верни JSON { "text": "...", "tone": "warn" }`;

    return (await this.askLLM(prompt)) ?? {
      text: isCorrect ? "Хорошо! Продолжай." : "Это неточно, попробуй подумать снова.",
      tone: isCorrect ? "encourage" : "warn",
    };
  }

  /** 3. Поздравление или утешение после окончания */
  async finishPuzzle(success: boolean, moves: number): Promise<PuzzleMessage> {
    const prompt = success
      ? `Придумай короткое поздравление игроку, который успешно решил шахматный паззл за ${moves} ходов. 
        Верни JSON { "text": "...", "tone": "celebrate" }`
      : `Придумай короткое утешение игроку, который не решил шахматный паззл. 
        Верни JSON { "text": "...", "tone": "consolate" }`;

    return (await this.askLLM(prompt)) ?? {
      text: success ? "Отличная работа, паззл решён! 🎉" : "Ничего страшного, попробуешь снова! 💪",
      tone: success ? "celebrate" : "consolate",
    };
  }

  async puzzleInstruction(themes: string[]): Promise<PuzzleMessage> {
    const joined = themes.join(", ");
    const prompt = `У тебя есть шахматный паззл с темами: [${joined}]. 
      Твоя задача: объясни игроку КОРОТКО, что здесь нужно сделать 
      (например: "Найди мат в два хода", "Обрати внимание на связку", "Сыграй на преимущество пешки").
      Пиши дружелюбно, 1–2 предложения. 
      Верни JSON { "text": "...", "tone": "neutral" }.`;

    return (await this.askLLM(prompt)) ?? {
      text: "Попробуй найти сильный тактический приём в этой позиции.",
      tone: "neutral",
    };
  }
}

export default new LlmPuzzleService("https://api.openai.com/v1", ENV.llm_api_key, "gpt-4o-mini");