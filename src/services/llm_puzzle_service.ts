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
          temperature: 0.8, // чуть больше креатива, чтобы приветствия и концовки были разнообразнее
          messages: [
            {
              role: "system",
              content: system_prompt,
            },
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

      const data = (await res.json()) as any;
      const content = data.choices?.[0]?.message?.content || "{}";
      const parsed = PuzzleMessageSchema.safeParse(JSON.parse(content));
      return parsed.success ? parsed.data : null;
    } catch (err) {
      return null;
    }
  }

  async greetPlayer(playerName?: string): Promise<PuzzleMessage> {
    const coin = Math.random() < 0.5;
    const namePart = playerName ? `Игрок ${playerName}` : "друг";
    let prompt: string;
    if(coin){
      prompt = `Придумай короткое и оригинальное приветствие для ${namePart}, который начинает решать шахматный паззл. 
      Будь дружелюбным. Используй crypto мемы и приколы.
      Верни JSON вида { "text": "...", "tone": "encourage" }`;
    }
    else {
      prompt = `Ты устал от вечных наплывов пользователей, и не хочешь их больше видеть, пошути на тему not eligible, dump рынка, что Monad скам, 
        Full Access роль не мультипликатор, и вообще MikeWeb заберет дроп себе. Не извиняйся за свои шутки. Не делай слишком большой ответ.
        Верни JSON вида { "text": "...", "tone": "encourage" }`;
    }
    
    return (
      (await this.askLLM(prompt)) ?? {
        text: "Удачи в этом паззле!",
        tone: "encourage",
      }
    );
  }

  async moveComment(
    isCorrect: boolean,
    move: string,
    step: number,
    total: number
  ): Promise<PuzzleMessage> {
    const coin = Math.random() < 0.5;
    let prompt: string;
    if (isCorrect) {
      if (coin) {
        // Доброе/дружелюбное
        prompt = `Скажи короткий комментарий к правильному ходу ${move} на шаге ${step + 1} из ${total}.
        Если ход был решающим, то вместо комментария поздравь игрока, который успешно решил шахматный паззл.
        Тон — encourage. Верни JSON { "text": "...", "tone": "encourage" }`;
      } else {
        // “Прикол, усталость, сарказм”
        prompt = `Ты устал от вечных наплывов пользователей, и не хочешь их больше видеть, пошути на тему not eligible, dump рынка, что Monad скам, 
        Full Access роль не мультипликатор, и вообще MikeWeb заберет дроп себе. Не извиняйся за свои шутки. Не делай слишком большой ответ.
        Тон — encourage, но с иронией. Верни JSON { "text": "...", "tone": "encourage" }`;
      }
    } else {
      if(coin){
        prompt = `Скажи короткий комментарий к ошибочному ходу ${move} на шаге ${step + 1} из ${total}.
        Тон — warn. Верни JSON { "text": "...", "tone": "warn" }`;
      }else{
        prompt = `Ты устал от вечных наплывов пользователей, и не хочешь их больше видеть, пошути на тему not eligible, dump рынка, что Monad скам, 
        Full Access роль не мультипликатор, и вообще MikeWeb заберет дроп себе. Только что, пользователь сделал неправильный ход, и тебя раздражает что он так глуп. 
        Пошути что теперь он not eligible, будет забанен, ты отнимешь у него роли, или вообще пожалуешься MikeWeb. Не извиняйся за свои шутки. Не делай слишком большой ответ.
        Тон — encourage, Верни JSON { "text": "...", "tone": "encourage" }`;
      }
    }

    return (
      (await this.askLLM(prompt)) ?? {
        text: isCorrect
          ? "Хорошо! Продолжай."
          : "Это неточно, попробуй подумать снова.",
        tone: isCorrect ? "encourage" : "warn",
      }
    );
  }

  async puzzleInstruction(themes: string[]): Promise<PuzzleMessage> {
    const joined = themes.join(", ");
    const prompt = `У тебя есть шахматный паззл с темами: [${joined}]. 
      Твоя задача: объясни игроку КОРОТКО, что здесь нужно сделать 
      (например: "Найди мат в два хода", "Обрати внимание на связку", "Сыграй на преимущество пешки").
      Пиши дружелюбно, 1–2 предложения. 
      Верни JSON { "text": "...", "tone": "neutral" }.`;

    return (
      (await this.askLLM(prompt)) ?? {
        text: "Попробуй найти сильный тактический приём в этой позиции.",
        tone: "neutral",
      }
    );
  }
}

export default new LlmPuzzleService(
  "https://api.openai.com/v1",
  ENV.llm_api_key,
  "gpt-4o-mini"
);
