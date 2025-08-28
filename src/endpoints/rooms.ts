import { Router, Request, Response } from "express";
import { Room, RoomMode, Side } from "../entity/Room";
import { AppDataSource } from "../config/database";
import { optionalAuthMiddleware } from "../middleware/auth_optional";
import { AuthRequest } from "../middleware/auth";
import { User } from "../entity/User";
import { MoveAnalysis } from "../entity/MoveAnalysis";
import { Move } from "../entity/Move";
import { Game } from "../entity/Game";
import { logger } from "../utils/log";
import { UserGameResult } from "../entity/UserGameResult";
import { Bot } from "../entity/Bot";

const router = Router();

function genCode(len = 6) {
  return Math.random().toString(36).substr(2, len).toUpperCase();
}

router.post(
  "/create",
  optionalAuthMiddleware,
  async (req: AuthRequest, res) => {
    const repo = AppDataSource.getRepository(Room);
    let code = genCode();
    while (await repo.findOne({ where: { code } })) code = genCode();
    const { mode, side, name: nameFromBody, botId } = req.body;

    let name: string;
    if (req.user?.userId) {
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOneOrFail({
        where: { id: req.user.userId },
      });
      name = user.username;
    } else {
      name = nameFromBody;
    }

    const validModes = ["pvp", "bot"];
    const validSides = ["white", "black", "random"];

    if (mode && !validModes.includes(mode)) {
      return res
        .status(400)
        .json({ error: "Invalid mode. Use 'pvp' or 'bot'." });
    }

    if (side && !validSides.includes(side)) {
      return res
        .status(400)
        .json({ error: "Invalid side. Use 'white', 'black' or 'random'." });
    }

    let botRating = null;
    if(botId) {
      const botRepo = AppDataSource.getRepository(Bot);
      const getBot = await botRepo.findOneOrFail(botId);
      botRating = getBot.rating;
    }

    const room = repo.create({
      code,
      name: name,
      mode: (mode as RoomMode) || "pvp",
      adminSide: (side as Side) || "random",
      botRating
    });
    await repo.save(room);
    res.json({ code: room.code });
  }
);

router.get("/bots", optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const botRepo = AppDataSource.getRepository(Bot);

      if (!userId) {
        const bots = await botRepo.createQueryBuilder("bot").addOrderBy("bot.rating", "ASC").getMany();
        if (bots.length === 0) return res.json({ bots: [] });

        const withFlag = bots.map((b, i) =>
          i === 0 ? { ...b, already_played: false } : b
        );
        return res.json({ bots: withFlag });
      }

      const qb = botRepo
        .createQueryBuilder("bot")
        .leftJoin(
          UserGameResult,
          "ugr",
          "ugr.botId = bot.id AND ugr.userId = :userId",
          { userId }
        )
        .select("bot")
        .addSelect(
          "CASE WHEN COUNT(ugr.id) > 0 THEN true ELSE false END",
          "already_played"
        )
        .groupBy("bot.id")
        .addOrderBy("bot.rating", "ASC");

      const { entities, raw } = await qb.getRawAndEntities();

      const result = entities.map((bot, idx) => {
        const played =
          raw[idx]?.already_played === true ||
          raw[idx]?.already_played === "true" ||
          raw[idx]?.already_played === 1;
        return { ...bot, already_played: !!played };
      });

      return res.json({ bots: result });
    } catch (err) {
      logger.error("bots error", err);
      return res.status(500).json({ error: "Internal error" });
    }
  }
);

router.get("/analyze/:code", async (req, res) => {
  try {
    const roomRepo = AppDataSource.getRepository(Room);

    const room = await roomRepo.findOne({
      where: { code: req.params.code },
    });

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    // достаём игру
    const gameRepo = AppDataSource.getRepository(Game);
    const game = await gameRepo.findOne({
      where: { room: { id: room.id } },
    });

    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    // достаём ходы
    const moveRepo = AppDataSource.getRepository(Move);
    const moves = await moveRepo.find({
      where: { game: { id: game.id } },
      order: { createdAt: "ASC" },
    });

    // достаём анализ ходов
    const analysisRepo = AppDataSource.getRepository(MoveAnalysis);
    const analyses = await analysisRepo.find({
      where: { game: { id: game.id } },
      order: { createdAt: "ASC" },
    });

    // удобно склеим в ответ
    return res.json({
      room,
      game,
      moves,
      analyses,
    });
  } catch (err) {
    logger.error("Analyze error", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

router.get("/:code", async (req, res) => {
  const repo = AppDataSource.getRepository(Room);
  const room = await repo.findOne({ where: { code: req.params.code } });
  if (!room) return res.status(404).json({ error: "not found" });
  res.json({ id: room.id, code: room.code, name: room.name });
});

export default router;
