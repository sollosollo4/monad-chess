import { Server as WebSocketServer, WebSocket } from "ws";
import http from "http";
import { AuthService } from "../services/auth_game";
import { GameService } from "../services/game";
import { RoomService } from "../services/room_game";
import { logger } from "../utils/log";
import { BotService } from "./game_bot";

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
      });

      const botSide =
        updated.white === "BOT"
          ? "white"
          : updated.black === "BOT"
          ? "black"
          : null;
      if (botSide && chess.turn() === (botSide === "white" ? "w" : "b")) {
        const botService = new BotService();
        const bestMove = await botService.getBestMove(chess.fen(), 12);

        if (bestMove) {
          const botMove = chess.move({
            from: bestMove.slice(0, 2),
            to: bestMove.slice(2, 4),
            promotion: "q",
          });

          if (botMove) {
            await this.gameService.makeMove(updated, "BOT", {
              from: botMove.from,
              to: botMove.to,
              promotion: "q",
            });

            this.roomService.broadcast(roomCode, {
              type: "move",
              from: botMove.from,
              to: botMove.to,
              san: botMove.san,
              fen: chess.fen(),
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
      ws.send(JSON.stringify({ type: "error", message: (e as Error).message }));
    }
  }
}

export default new WebSocketService({
  port: 6455,
});
