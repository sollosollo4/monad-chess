import { spawn } from "child_process";
import { logger } from "../utils/log";
import { Chess } from "chess.js";

type Severity =
  | "brilliant"
  | "great"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";
class StockfishService {
  private engine;
  private listeners: ((line: string) => void)[] = [];

  constructor() {
    this.engine = spawn("stockfish");
    this.engine.stdout.on("data", (data) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        this.listeners.forEach((cb) => cb(line));
      }
    });

    this.send("uci");
    logger.info("[BotService] Stockfish started");
  }

  private send(cmd: string) {
    this.engine.stdin.write(cmd + "\n");
  }

  async getBestMove(fen: string, depth = 12, elo = 1600): Promise<string> {
    return new Promise((resolve) => {
      this.send("setoption name UCI_LimitStrength value true");
      this.send(`setoption name UCI_Elo value ${elo}`);
      const handler = (line: string) => {
        if (line.startsWith("bestmove")) {
          const move = line.split(" ")[1];
          this.listeners = this.listeners.filter((cb) => cb !== handler);
          resolve(move);
        }
      };
      this.listeners.push(handler);

      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
    });
  }

  /**
   * Анализирует позицию и возвращает "сырые" данные движка
   */
  async getEvaluation(
    fen: string,
    depth = 12
  ): Promise<{ type: "cp" | "mate"; value: number; pv: string[] }> {
    return new Promise((resolve) => {
      const handler = (line: string) => {
        if (line.startsWith("info") && line.includes("score")) {
          const matchCp = line.match(/score cp (-?\d+)/);
          const matchMate = line.match(/score mate (-?\d+)/);
          const matchPv = line.match(/ pv (.+)$/);
          const pv = matchPv ? matchPv[1].trim().split(" ") : [];

          if (matchMate) {
            this.listeners = this.listeners.filter((cb) => cb !== handler);
            resolve({ type: "mate", value: parseInt(matchMate[1], 10), pv });
          } else if (matchCp) {
            this.listeners = this.listeners.filter((cb) => cb !== handler);
            resolve({ type: "cp", value: parseInt(matchCp[1], 10), pv });
          }
        }
      };
      this.listeners.push(handler);

      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
    });
  }

  /**
   * Дает "человеческий" комментарий по позиции
   */
  async getComment(fen: string, depth = 12): Promise<string> {
    const evalResult = await this.getEvaluation(fen, depth);

    if (evalResult.type === "mate") {
      if (evalResult.value > 0)
        return `White checkmates in ${evalResult.value} move(s)!`;
      else return `Black checkmates in ${Math.abs(evalResult.value)} move(s)!`;
    }

    const cp = evalResult.value;
    if (cp > 300) return "White has a big advantage.";
    if (cp > 100) return "The white ones are a little better.";
    if (cp > -100) return "The position is approximately equal.";
    if (cp > -300) return "Black has a slight advantage.";
    return "Black has a big advantage.";
  }

  /**
   * Оценка сделанного хода vs лучший ход
   */
  async analyzeMove(
    fen: string,
    from: string,
    to: string,
    depth = 12
  ): Promise<{ comment: string; bestMove: string }> {
    const chess = new Chess(fen);
    const move = `${from}${to}`;

    const evalBefore = await this.getEvaluation(fen, depth);

    const bestMove = await this.getBestMove(fen, depth, 3000);

    if (!chess.move(move)) {
      throw new Error(`The move ${move} is invalid in this position.`);
    }
    const newFen = chess.fen();

    const evalAfter = await this.getEvaluation(newFen, depth);

    let comment = "";
    if (evalAfter.type === "mate") {
      if (evalAfter.value > 0) comment = "Excellent! White checkmates.";
      else comment = "Bad: Black gets forced checkmate.";
    } else {
      const diff = evalAfter.value - evalBefore.value;

      if (move === bestMove) {
        comment = `Great move! This matches the engine's recommendation (${bestMove}).`;
      } else if (diff > -50) {
        comment = `The move ${move} is quite normal, but the engine preferred ${bestMove}.`;
      } else if (diff > -200) {
        comment = `Move ${move} weakened the position. It was better to play ${bestMove}.`;
      } else {
        comment = `The move ${move} is a serious mistake! The position is much worse after it. The engine advised ${bestMove}.`;
      }
    }

    return { comment, bestMove };
  }

  async analyzeMoveDetailed(
    fenBefore: string,
    fenAfter: string,
    from: string, 
    to: string,
    promotion: string,
    depth = 12
  ): Promise<{
    fenAfter: string;
    evalBeforeCp: number | null;
    evalAfterCp: number | null;
    bestMove: string | null;
    severity:
      | "brilliant"
      | "great"
      | "good"
      | "inaccuracy"
      | "mistake"
      | "blunder";
    pv: string[];
  }> {
    const evalBefore = await this.getEvaluation(fenBefore, depth);

    const bestMove = await this.getBestMove(fenBefore, depth, 3000);

    const move = `${from}${to}${promotion ?? ""}`;
    

    const evalAfter = await this.getEvaluation(fenAfter, depth);

    const diff = (evalAfter.value ?? 0) - (evalBefore.value ?? 0);

    let severity: Severity = "good";
    if (diff > -30 && move === bestMove) severity = "brilliant";
    else if (diff > -50) severity = "great";
    else if (diff > -150) severity = "inaccuracy";
    else if (diff > -300) severity = "mistake";
    else severity = "blunder";

    return {
      fenAfter,
      evalBeforeCp: evalBefore.type === "cp" ? evalBefore.value : null,
      evalAfterCp: evalAfter.type === "cp" ? evalAfter.value : null,
      bestMove,
      severity,
      pv: evalBefore.pv,
    };
  }
}

export default new StockfishService();
