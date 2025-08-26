import { Chess } from "chess.js";
import { AppDataSource } from "../config/database";
import { Game } from "../entity/Game";
import { Move } from "../entity/Move";
import { Room } from "../entity/Room";
import { RoomService } from "./room_game";
import  StockfishService  from "./stockfish_service";
import { logger } from "../utils/log";
import { sendEvent } from "../rabbitmq/client";

export class TimeoutError extends Error {
  winner;
  constructor(winner: string) {
    super();
    this.winner = winner;
  }
}

export class GameService {
  private gameRepo = AppDataSource.getRepository(Game);
  private moveRepo = AppDataSource.getRepository(Move);
  private roomRepo = AppDataSource.getRepository(Room);

  async getOrCreateGame(roomCode: string, username: string) {
    const room = await this.roomRepo.findOne({ where: { code: roomCode } });
    if (!room) throw new Error("Room not found");

    let game = await this.gameRepo.findOne({ 
      where: { room: { id: room.id }}, 
      relations: ["room"] 
    });
    
    if(game && !game.active)
      throw new Error("Already played");

    if (!game) {
      const chess = new Chess();

      // распределяем стороны
      let white = "";
      let black = "";

      if (room.adminSide === "random") {
        // случайно выбрать сторону админа
        const adminSide = Math.random() > 0.5 ? "white" : "black";
        room.adminSide = adminSide;
        await this.roomRepo.save(room);
      }

      if (room.adminSide === "white") {
        white = username;
        black = room.mode === "bot" ? "BOT" : "";
      } else if (room.adminSide === "black") {
        black = username;
        white = room.mode === "bot" ? "BOT" : "";
      }

      game = this.gameRepo.create({
        room,
        white,
        black,
        fen: chess.fen(),
        active: true,
        whiteTime: 300, // 5 мин
        blackTime: 300,
        increment: 2, // например, +2 сек за ход
        lastMoveAt: Date.now(),
      });
      await this.gameRepo.save(game);

      if (white === "BOT" && chess.turn() === "w") {
        await this.makeBotMove(game, room.code);
      }
    } else {
      if (!game.white && game.black !== username) {
        game.white = username;
        await this.gameRepo.save(game);
      } else if (!game.black && game.white !== username) {
        game.black = username;
        await this.gameRepo.save(game);
      }
    }

    return game;
  }

  async makeBotMove(game: Game, roomCode: string) {
    const chess = new Chess(game.fen);

    const best = await StockfishService.getBestMove(chess.fen());
    if (!best) return;

    const move = chess.move({
      from: best.substring(0, 2),
      to: best.substring(2, 4),
      promotion: "q",
    });

    if (!move) return;

    await this.moveRepo.save(
      this.moveRepo.create({
        game,
        from: move.from,
        to: move.to,
        san: move.san,
        by: "BOT",
      })
    );

    game.fen = chess.fen();
    if (chess.isGameOver()) game.active = false;
    
    await this.gameRepo.save(game);

    const roomService = new RoomService();
    roomService.broadcast(roomCode, {
      type: "move",
      from: move.from,
      to: move.to,
      san: move.san,
      fen: game.fen,
      by: "BOT",
    });

    if (!game.active) {
      roomService.broadcast(roomCode, {
        type: "game_over",
        result: this.determineResult(chess),
      });
    }
  }

  async makeMove(game: Game, username: string, msg: any) {
    const chess = new Chess(game.fen);

    const sideToMove = chess.turn() === "w" ? "white" : "black";
    const expectedUsername = sideToMove === "white" ? game.white : game.black;

    if (username.toLowerCase() !== expectedUsername?.toLowerCase()) {
      throw new Error("Not your turn");
    }

    const now = Date.now();
    if (game.lastMoveAt) {
      const elapsed = Math.floor((now - game.lastMoveAt) / 1000);
      if (sideToMove === "white") {
        game.whiteTime -= elapsed;
        if (game.whiteTime <= 0) {
          game.active = false;
          await this.gameRepo.save(game);
          throw new TimeoutError("black");
        }
      } else {
        game.blackTime -= elapsed;
        if (game.blackTime <= 0) {
          game.active = false;
          await this.gameRepo.save(game);
          throw new TimeoutError("white");
        }
      }
    }

    await sendEvent({ 
      before_fen: game.fen, 
      from: msg.from, 
      to: msg.to, 
      promotion: msg.promotion, 
      gameId: game.id, 
      username, 
      sideToMove
    });

    const move = chess.move({
      from: msg.from,
      to: msg.to,
      promotion: msg.promotion,
    });

    if (!move) throw new Error("Invalid move");

    if (sideToMove === "white") game.whiteTime += game.increment;
    else game.blackTime += game.increment;

    await this.moveRepo.save(
      this.moveRepo.create({
        game,
        from: msg.from,
        to: msg.to,
        san: move.san,
        by: username,
      })
    );

    game.lastMoveAt = now;
    game.fen = chess.fen();
    if (chess.isGameOver()) {
      game.active = false;
    }

    await this.gameRepo.save(game);

    return { move, game, chess };
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
