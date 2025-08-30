import { Router, Request, Response } from "express";
import { AppDataSource } from "../config/database";
import { optionalAuthMiddleware } from "../middleware/auth_optional";
import { AuthRequest } from "../middleware/auth";
import { Game } from "../entity/Game";

const router = Router();

router.post("/pass", optionalAuthMiddleware, async (req: AuthRequest, res) => {
  const { code } = req.body;
  const gameRepo = AppDataSource.getRepository(Game);

  const game = await gameRepo.findOneOrFail({
    where: { room: { code } },
    relations: ["room"],
  });

  game.active = false;
  await gameRepo.save(game);

  res.json({ success: true, gameId: game.id });
});

export default router;
