import { spawn } from "child_process";
import { logger } from "../utils/log";

export class BotService {
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

  async getBestMove(fen: string, depth = 12): Promise<string> {
    return new Promise((resolve) => {
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
}