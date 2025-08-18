import Stockfish from "stockfish";
import { Chess } from "chess.js";

export class BotService {
  private engine: any;
  private ready: boolean = false;

  constructor() {
    this.engine = Stockfish();

    this.engine.onmessage = (event: any) => {
      const line = event.toString();
      if (line.includes("uciok")) {
        this.ready = true;
        console.log("[BotService] Stockfish ready");
      }
    };

    this.engine.postMessage("uci");
  }

  async getBestMove(fen: string): Promise<string | null> {
    if (!this.ready) {
      console.warn("[BotService] Engine not ready yet");
      return null;
    }

    return new Promise((resolve) => {
      let bestMove: string | null = null;

      this.engine.onmessage = (event: any) => {
        const line = event.toString();

        if (line.startsWith("bestmove")) {
          bestMove = line.split(" ")[1];
          resolve(bestMove);
        }
      };

      this.engine.postMessage(`position fen ${fen}`);
      this.engine.postMessage("go depth 12"); // глубина поиска
    });
  }
}