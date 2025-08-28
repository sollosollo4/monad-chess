import express from "express";
import { checkJwt, AuthRequest } from "../middleware/auth";
import { verifyMessage, ethers } from "ethers";
import { AppDataSource } from "../config/database";
import { User } from "../entity/User";
import { UserGameResult } from "../entity/UserGameResult";
import { UserPuzzleResult } from "../entity/UserPuzzleResult";

const router = express.Router();
router.get("/me", checkJwt, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.user;
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneOrFail(userId);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "ServerError", message: "Server error" },
    });
  }
});

router.get("/puzzles", checkJwt, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.user;

    const repo = AppDataSource.getRepository(UserPuzzleResult);
    const puzzles = await repo.find({
      where: { user: { id: userId } },
      relations: ["puzzle"],
    });

    res.json({ success: true, puzzles });
  } catch (err) {
    console.error("profile puzzles error", err);
    res.status(500).json({
      success: false,
      error: { code: "ServerError", message: "Server error" },
    });
  }
});

router.get("/games", checkJwt, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.user;

    const repo = AppDataSource.getRepository(UserGameResult);
    const games = await repo.find({
      where: { user: { id: userId } },
      relations: ["game", "enemy", "bot"],
      order: { createdAt: "DESC" },
    });

    res.json({ success: true, games });
  } catch (err) {
    console.error("profile games error", err);
    res.status(500).json({
      success: false,
      error: { code: "ServerError", message: "Server error" },
    });
  }
});

export default router;
