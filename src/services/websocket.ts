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
import { Helper } from "../utils/helper";
import { sendEvent } from "../rabbitmq/client";
import { UserExperience } from "../entity/UserExperience";
import { UserGameResult } from "../entity/UserGameResult";

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

      ws.send(
        JSON.stringify({
          type: "puzzle",
          commentary,
        })
      );
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", message: (e as Error).message }));
    }
  }

  private async handleAuth(ws: WebSocket, msg: any) {
    try {
      const user = await this.authService.authenticate(msg.token);
      (ws as any).username = user.username;
      this.roomService.joinRoom(ws, msg.room);

      const getGame = await this.gameService.getOrCreateGame(
        msg.room,
        user.username
      );

      ws.send(
        JSON.stringify({
          type: "game_state",
          fen: getGame.game.fen,
          white: getGame.game.white,
          black: getGame.game.black,
        })
      );

      this.roomService.broadcast(msg.room, {
        type: "players",
        white: getGame.game.white,
        black: getGame.game.black,
      });

      if (getGame.game.white == "BOT" && getGame.botMove) {
        this.roomService.broadcast(msg.room, {
          type: "move",
          from: getGame.botMove.from,
          to: getGame.botMove.to,
          san: getGame.botMove.san,
          fen: getGame.botMove.chess.fen(),
          by: "BOT",
        });
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", message: (e as Error).message }));
    }
  }

  private async handleMove(ws: WebSocket, msg: any) {
    const username = (ws as any).username;
    const roomCode = (ws as any).room;
    try {
      const user = await this.authService.authenticate(msg.token);
      if (!username || !roomCode || !user) throw new Error("Not authenticated");
      const getGame = await this.gameService.getOrCreateGame(
        roomCode,
        username
      );

      const {
        move,
        game: updated,
        chess,
      } = await this.gameService.makeMove(getGame.game, username, msg);

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
        const botDepth = Helper.getDepthByRating(
          getGame.game.room.botRating ?? 1200
        );
        
        const botMove = await this.gameService.makeBotMove(
          updated,
          botDepth,
          updated.room.botRating ?? 1000
        );
        if (botMove) {
          this.roomService.broadcast(roomCode, {
            type: "move",
            from: botMove.from,
            to: botMove.to,
            san: botMove.san,
            fen: botMove.chess.fen(),
            by: "BOT",
          });

          if (!botMove.game.active) {
            const result = await this.gameService.finalizeGame(
              botMove.game,
              chess,
              "stalemate",
              botSide
            );
            this.roomService.broadcast(roomCode, {
              type: "game_over",
              result,
            });

            const gameResultRepo = AppDataSource.getRepository(UserGameResult);
            const newReslt = gameResultRepo.create({
              game: botMove.game,
              user,
              enemy: null,
              bot: botMove.game.room.bot,
              is_bot: true,
              result: 'l',
              color: botMove.game.room.adminSide,
              reason: result.reason
            });
            await gameResultRepo.save(newReslt);

          }
        }
      }

      // Если игрок закончил игру (без бота)
      if (!updated.active && !botSide) {
        const result = await this.gameService.finalizeGame(updated, chess);
        this.roomService.broadcast(roomCode, {
          type: "game_over",
          result,
        });
        await UserExperience.give(user.id, "game_played");
        const gameResultRepo = AppDataSource.getRepository(UserGameResult);
        const newReslt = gameResultRepo.create({
          game: updated,
          user,
          enemy: null,
          bot: updated.room.bot,
          is_bot: true,
          result: 'w',
          color: updated.room.adminSide,
          reason: result.reason
        });
        await gameResultRepo.save(newReslt);
      }
    } catch (e) {
      if (e instanceof TimeoutError) {
        const user = await this.authService.authenticate(msg.token);
        const getGame = await this.gameService.getOrCreateGame(
          roomCode,
          username
        );
        const result = await this.gameService.finalizeGame(
          getGame.game,
          new Chess(getGame.game.fen),
          "timeout",
          e.winner
        );
        this.roomService.broadcast(roomCode, {
          type: "game_over",
          result,
        });
        const gameResultRepo = AppDataSource.getRepository(UserGameResult);
        const newReslt = gameResultRepo.create({
          game: getGame.game,
          user,
          enemy: null,
          bot: getGame.game.room.bot,
          is_bot: getGame.game.room.bot == null ? false : true,
          result: 'l',
          color: getGame.game.room.adminSide,
          reason: result.reason
        });
        await gameResultRepo.save(newReslt);
        return;
      }
      console.log(e);
      ws.send(JSON.stringify({ type: "error", message: (e as Error).message }));
    }
  }
}

export default new WebSocketService({
  port: 6455,
});
