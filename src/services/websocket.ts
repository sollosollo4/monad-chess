import { Server as WebSocketServer, WebSocket } from "ws";
import http from "http";
import { AuthService } from "../services/auth_game";
import { GameService, TimeoutError } from "../services/game";
import { RoomService } from "../services/room_game";
import { logger } from "../utils/log";
import StockfishService from "./stockfish_service";
import { Puzzle } from "../entity/Puzzle";
import { AppDataSource } from "../config/database";
import LlmPuzzleService from "../services/llm_puzzle_service";
import { Chess } from "chess.js";

interface IWebSocketServiceOptions {
  port?: number;
  server?: http.Server;
  path?: string;
}

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private readonly options: IWebSocketServiceOptions;
  private authService = new AuthService();
  private gameService = new GameService();
  private roomService = new RoomService();

  constructor(options: IWebSocketServiceOptions = {}) {
    this.options = options;
  }

  public start(): void {
    const { port, server, path = "" } = this.options;
    this.wss = new WebSocketServer({ port, server, path });
    logger.info(`[WebSocket] Server started on port ${port}, path: ${path}`);

    this.wss.on("connection", async (ws: WebSocket) => {
      ws.on("message", async (raw) => {
        try {
          const msg = JSON.parse(raw.toString());

          switch (msg.type) {
            case "auth":
              await this.handleAuth(ws, msg);
              break;
            case "move":
              await this.handleMove(ws, msg);
              break;
            case "puzzle":
              await this.handlePuzzle(ws, msg);
              break;
            default:
              ws.send(
                JSON.stringify({ type: "error", message: "unknown message" })
              );
          }
        } catch (e) {
          console.error("ws message error", e);
        }
      });

      ws.on("close", () => {
        this.roomService.leaveRoom(ws);
      });
    });
  }

  async handlePuzzle(ws: WebSocket, msg: any) {
    try {
      const puzzleRepo = AppDataSource.getRepository(Puzzle);
      const { id, move, step } = msg;
      if (!id || !move || typeof step !== "number") {
        return ws.send(
          JSON.stringify({ error: "id, move and step are required" })
        );
      }

      const puzzle = await puzzleRepo.findOneBy({ id });
      if (!puzzle) {
        return ws.send(JSON.stringify({ error: "Puzzle not found" }));
      }

      const chess = new Chess(puzzle.fen);

      for (let i = 0; i < step; i++) {
        const prevMove = puzzle.solution[i];
        const from = prevMove.slice(0, 2);
        const to = prevMove.slice(2, 4);
        const promotion = prevMove.length === 5 ? prevMove[4] : undefined;
        chess.move({ from, to, promotion });
      }

      const expectedMove = puzzle.solution[step];

      const commentary = await LlmPuzzleService.moveComment(
        move === expectedMove,
        move,
        step,
        puzzle.solution.length
      );

      ws.send(JSON.stringify({
        type: "puzzle",
        commentary
      }));
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", message: (e as Error).message }));
    }
  }

  private async handleAuth(ws: WebSocket, msg: any) {
    try {
      const user = await this.authService.authenticate(msg.token);
      (ws as any).username = user.username;
      this.roomService.joinRoom(ws, msg.room);

      const game = await this.gameService.getOrCreateGame(
        msg.room,
        user.username
      );

      ws.send(
        JSON.stringify({
          type: "game_state",
          fen: game.fen,
          white: game.white,
          black: game.black,
        })
      );

      this.roomService.broadcast(msg.room, {
        type: "players",
        white: game.white,
        black: game.black,
      });
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", message: (e as Error).message }));
    }
  }

  private async handleMove(ws: WebSocket, msg: any) {
    try {
      const username = (ws as any).username;
      const roomCode = (ws as any).room;
      if (!username || !roomCode) throw new Error("Not authenticated");

      const game = await this.gameService.getOrCreateGame(roomCode, username);

      const {
        move,
        game: updated,
        chess,
      } = await this.gameService.makeMove(game, username, msg);

      this.roomService.broadcast(roomCode, {
        type: "move",
        from: msg.from,
        to: msg.to,
        san: move.san,
        fen: updated.fen,
        by: username,
        whiteTime: updated.whiteTime,
        blackTime: updated.blackTime,
      });

      const botSide =
        updated.white === "BOT"
          ? "white"
          : updated.black === "BOT"
          ? "black"
          : null;
      if (botSide && chess.turn() === (botSide === "white" ? "w" : "b")) {
        const bestMove = await StockfishService.getBestMove(updated.fen, 12);

        if (bestMove) {
          const botMove = chess.move({
            from: bestMove.slice(0, 2),
            to: bestMove.slice(2, 4),
            promotion: "q",
          });

          if (botMove) {
            const { chess: updatedChess } = await this.gameService.makeMove(
              updated,
              "BOT",
              {
                from: botMove.from,
                to: botMove.to,
                promotion: "q",
              }
            );

            this.roomService.broadcast(roomCode, {
              type: "move",
              from: botMove.from,
              to: botMove.to,
              san: botMove.san,
              fen: updatedChess.fen(),
              by: "BOT",
            });

            if (chess.isGameOver()) {
              this.roomService.broadcast(roomCode, {
                type: "game_over",
                result: this.gameService.determineResult(chess),
              });
            }
          }
        }
      }

      // Если игрок закончил игру (без бота)
      if (!updated.active && !botSide) {
        this.roomService.broadcast(roomCode, {
          type: "game_over",
          result: this.gameService.determineResult(chess),
        });
      }
    } catch (e) {
      if (e instanceof TimeoutError) {
        const roomCode = (ws as any).room;
        this.roomService.broadcast(roomCode, {
          type: "game_over",
          result: { reason: "timeout", winner: e.winner },
        });
        return;
      }
      ws.send(JSON.stringify({ type: "error", message: (e as Error).message }));
    }
  }
}

export default new WebSocketService({
  port: 6455,
});
