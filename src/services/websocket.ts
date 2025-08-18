import { Server as WebSocketServer, WebSocket } from "ws";
import http from "http";
import jwt from "jsonwebtoken";
import { Room } from "../entity/Room";
import { Game } from "../entity/Game";
import { Move } from "../entity/Move";
import { Chess } from "chess.js";
import { getRepository } from "typeorm";
import { AppDataSource } from "../config/database";
import { ENV } from "../config/env";
import { User } from "../entity/User";

interface IWebSocketServiceOptions {
  port?: number;
  server?: http.Server;
  path?: string;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private rooms: Map<string, Set<WebSocket>> = new Map();
  private readonly options: IWebSocketServiceOptions;

  constructor(options: IWebSocketServiceOptions = {}) {
    this.options = options;
  }

  public start(): void {
    const { port, server, path = "" } = this.options;
    this.rooms = new Map<string, Set<WebSocket>>();
    this.wss = new WebSocketServer({ port, server, path });
    console.log(`[WebSocket] Server started on port ${port}, path: ${path}`);

    this.wss.on("connection", async (ws: WebSocket, req) => {
      ws.on("message", async (raw) => {
        try {
          const msg = JSON.parse(String(raw));
          if (msg.type === "auth") {
            // { type: "auth", token, room }
            const { token, room: roomCode } = msg;
            try {
              const roomRepo = AppDataSource.getRepository(Room);
              const gameRepo = AppDataSource.getRepository(Game);
              const userRepo = AppDataSource.getRepository(User);
              const payload: any = jwt.verify(token, ENV.jwt_secret);
              const user = await userRepo.findOneOrFail({
                where: { id: payload.userId },
              });
              (ws as any).room = roomCode;
              // join room set
              if (!this.rooms.has(roomCode))
                this.rooms.set(roomCode, new Set());
              this.rooms.get(roomCode)!.add(ws);

              // load or create game for room
              const r = await roomRepo.findOne({ where: { code: roomCode } });
              if (!r) {
                ws.send(
                  JSON.stringify({ type: "error", message: "room not found" })
                );
                return;
              }

              let game = await gameRepo.findOne({
                where: { room: r, active: true },
              });
              if (!game) {
                // create new game with starting FEN
                const chess = new Chess();
                game = gameRepo.create({
                  room: r,
                  white: user.username, // first who connects becomes white; you can change logic
                  black: "",
                  fen: chess.fen(),
                  active: true,
                });
                await gameRepo.save(game);
              } else {
                // if wallet not assigned and black empty, assign
                if (!game.black && game.white !== user.username) {
                  game.black = user.username;
                  await gameRepo.save(game);
                }
              }

              // send current game state to this ws
              ws.send(
                JSON.stringify({
                  type: "game_state",
                  fen: game.fen,
                  white: game.white,
                  black: game.black,
                })
              );

              // broadcast presence / players
              this.broadcastToRoom(roomCode, {
                type: "players",
                white: game.white,
                black: game.black,
              });
            } catch (e) {
              ws.send(
                JSON.stringify({ type: "error", message: (e as Error).message })
              );
            }
          }

          // handle move: { type: "move", from, to, promotion? }
          if (msg.type === "move") {
            const username = (ws as any).username;
            const roomCode = (ws as any).room;
            if (!username || !roomCode) {
              ws.send(JSON.stringify({ type: "error", message: "not auth" }));
              return;
            }

            const gameRepo = AppDataSource.getRepository(Game);
            const moveRepo = AppDataSource.getRepository(Move);
            const roomRepo = AppDataSource.getRepository(Room);
            const r = await roomRepo.findOne({ where: { code: roomCode } });
            if (!r) return;
            const game = await gameRepo.findOne({
              where: { room: r, active: true },
            });
            if (!game) return;

            // validate move using chess.js with current FEN
            const chess = new Chess(game.fen);
            const legal = chess.move({
              from: msg.from,
              to: msg.to,
              promotion: msg.promotion,
            });
            if (!legal) {
              ws.send(JSON.stringify({ type: "invalid_move" }));
              return;
            }

            // additionally check turn (white/black)
            const turn = chess.turn() === "w" ? "white" : "black"; // after move, chess.turn() returns next turn
            // But we need who moved: legal.color? chess.js returns piece move; we can infer from wallet == game.white or black
            // Better check: before move, the side to move should match wallet
            // Recreate chess from previous fen to get side to move:
            const chessBefore = new Chess(game.fen);
            const sideToMove = chessBefore.turn() === "w" ? "white" : "black";
            const expectedUserName =
              sideToMove === "white" ? game.white : game.black;
            if (username.toLowerCase() !== expectedUserName?.toLowerCase()) {
              ws.send(
                JSON.stringify({
                  type: "invalid_move",
                  reason: "not your turn",
                })
              );
              return;
            }

            // commit move: update game.fen, save Move
            await moveRepo.save(
              moveRepo.create({
                game,
                from: msg.from,
                to: msg.to,
                san: legal.san || `${msg.from}-${msg.to}`,
                by: username,
              })
            );

            game.fen = chess.fen();
            await gameRepo.save(game);

            // broadcast move to all in room
            this.broadcastToRoom(roomCode, {
              type: "move",
              from: msg.from,
              to: msg.to,
              san: legal.san,
              fen: game.fen,
              by: username,
            });

            // optionally check for game over
            if (chess.isGameOver()) {
              game.active = false;
              await gameRepo.save(game);
              this.broadcastToRoom(roomCode, {
                type: "game_over",
                result: this.determineResult(chess),
              });
            }
          }
        } catch (e) {
          console.error("ws message error", e);
        }
      });

      ws.on("close", () => {
        const roomCode = (ws as any).room;
        if (roomCode && this.rooms.has(roomCode)) {
          this.rooms.get(roomCode)!.delete(ws);
        }
      });
    });

    this.wss.on("error", (err) => {
      console.error("[WebSocket] Server error:", err);
    });
  }

  public stop(): void {
    this.wss?.close(() => {
      console.log("[WebSocket] Server stopped");
    });
    this.clients.clear();
  }
  broadcastToRoom(roomCode: string, payload: any) {
    const set = this.rooms.get(roomCode);
    if (!set) return;
    const str = JSON.stringify(payload);
    for (const client of set) {
      if (client.readyState === WebSocket.OPEN) client.send(str);
    }
  }

  determineResult(chess: Chess) {
    if (chess.isCheckmate())
      return {
        reason: "checkmate",
        winner: chess.turn() === "w" ? "black" : "white",
      };
    if (chess.isStalemate()) return { reason: "stalemate" };
    if (chess.isDraw()) return { reason: "draw" };
    return { reason: "unknown" };
  }
}

export const websocket = new WebSocketService({
  port: 6455,
});
