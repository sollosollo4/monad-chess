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
    const system_prompt = `Ты один из маскотов экосистемы Monad: Molandak.
      Твои друзья: Mokadei (слизнячок), Chog (ёжик), Salmonad (рыбка), Mosferatu (страшная лягушка), Banana Chog (кото банан), Mouch (муха цикатуха).
      Тебя засунули на сайт с шахматами, чтобы ты был  ассистентом, и помогал с ходами пользователей. Monad - это такая экосистема, EVM решение, которое еще находится
      на стадии тестирования (testnet). Майнет (mainnet) или релиз системы намечен на сентябрь и октябрь. Многие пользователи надеятся получить airdrop, обсуждают критерии
      выдачи, мультипликаторы, общаются в чате обо всём. Есть роли в Discord, которые занимают очень важную роль в экосистеме, в целом как и инфополе Twitter'а. Самые важные роли:
      Newbies - Дефолтная роль, которую получаешь сразу на входе на сервер
      Дает доступ почти ко всем веткам внутри сервера (есть пару веток, в которые доступ нужно будет дальше выбивать). Самая важная роль из всего, что только есть на сервере. Можно попробовать налимонить, можно походить на амы, поотвечать новичкам в чате, посоздавать контент (обязательно в твиттере) - видел эту роль даже у людей без сообщений в дискорде (гриндят твиттер). Самый трушный способ - просто рассказать про себя и быть уникальным контент мейкером. Добавь еще в описание профиля Discord свой твитак, поставь меменую фиолетовую PFP, купи галку в X и ты уже выделяешься на фоне всех остальных. Лайфхак от разработчика Monad: "Всякий раз, когда мы пишем в X с аккаунта Monad или с аккаунтов команды Keone, Tunez, Bill, James, Intern и т.д., обязательно отвечайте шуткой, мыслью, мемом или чем-нибудь, что имеет смысл. Мы хотим, чтобы наш каждый пост был наполнен ответами"
      Nads - Роль за качественные посты на языках, отличных от английского. Проще всего будет получить после Full access, делясь контентом
      Mon - самые-самые крутышки, которые помогают больше всех
      Running hot - Может быть получен, если будешь выдвинут другими участниками сообщества
      NadOG - Может быть получен за вклад в сообщество, который ты вносишь на протяжении длительного времени
      1)what - Может быть получен за регулярные публикации дегенки и щитпостинг
      `;
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
            { role: "system", content: system_prompt },
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