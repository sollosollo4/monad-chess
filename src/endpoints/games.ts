import { Router, Request, Response } from "express";
import { AppDataSource } from "../config/database";
import { optionalAuthMiddleware } from "../middleware/auth_optional";
import { AuthRequest } from "../middleware/auth";
import { Game } from "../entity/Game";
import { UserGameResult } from "../entity/UserGameResult";
import { User } from "../entity/User";

const router = Router();

router.post("/pass", optionalAuthMiddleware, async (req: AuthRequest, res) => {
  const { code } = req.body;
  const gameRepo = AppDataSource.getRepository(Game);
  const userRepo = AppDataSource.getRepository(User);

  const user = await userRepo.findOneOrFail(req.user.userId);

  const game = await gameRepo.findOneOrFail({
    where: { room: { code } },
    relations: ["room"],
  });

  game.active = false;
  await gameRepo.save(game);

 
  const gameResultRepo = AppDataSource.getRepository(UserGameResult);
  const newReslt = gameResultRepo.create({
    game: game,
    user,
    enemy: null,
    bot: game.room.bot,
    is_bot: true,
    result: 'l',
    color: game.room.adminSide,
    reason: 'pass'
  });
  await gameResultRepo.save(newReslt);

  res.json({ success: true, gameId: game.id });
});

export default router;
