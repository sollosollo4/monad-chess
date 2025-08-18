import { Chess } from "chess.js";
import { AppDataSource } from "../config/database";
import { Game } from "../entity/Game";
import { Move } from "../entity/Move";
import { Room } from "../entity/Room";

export class GameService {
  private gameRepo = AppDataSource.getRepository(Game);
  private moveRepo = AppDataSource.getRepository(Move);
  private roomRepo = AppDataSource.getRepository(Room);

  async getOrCreateGame(roomCode: string, username: string) {
    const room = await this.roomRepo.findOne({ where: { code: roomCode } });
    if (!room) throw new Error("Room not found");

    let game = await this.gameRepo.findOne({ where: { room, active: true } });

    if (!game) {
      const chess = new Chess();
      game = this.gameRepo.create({
        room,
        white: username,
        black: "",
        fen: chess.fen(),
        active: true,
      });
      await this.gameRepo.save(game);
    } else if (!game.black && game.white !== username) {
      game.black = username;
      await this.gameRepo.save(game);
    }

    return game;
  }

  async makeMove(game: Game, username: string, msg: any) {
    const chess = new Chess(game.fen);

    // проверка чей ход
    const sideToMove = chess.turn() === "w" ? "white" : "black";
    const expectedUsername =
      sideToMove === "white" ? game.white : game.black;

    if (username.toLowerCase() !== expectedUsername?.toLowerCase()) {
      throw new Error("Not your turn");
    }

    const move = chess.move({
      from: msg.from,
      to: msg.to,
      promotion: msg.promotion,
    });

    if (!move) throw new Error("Invalid move");

    await this.moveRepo.save(
      this.moveRepo.create({
        game,
        from: msg.from,
        to: msg.to,
        san: move.san,
        by: username,
      })
    );

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