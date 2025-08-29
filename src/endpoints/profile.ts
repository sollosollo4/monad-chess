import express from "express";
import { checkJwt, AuthRequest } from "../middleware/auth";
import { verifyMessage, ethers } from "ethers";
import { AppDataSource } from "../config/database";
import { User } from "../entity/User";
import { UserGameResult } from "../entity/UserGameResult";
import { UserPuzzleResult } from "../entity/UserPuzzleResult";
import { Helper } from "../utils/helper";
import { rateLimit } from "../utils/rate-limiter";
import { isValidAddress, updatePlayerData } from "../services/blockchain";
import {
  generateRequestId,
  isDuplicateRequest,
  markRequestComplete,
  markRequestProcessing,
} from "../utils/request-deduplication";
import { logger } from "../utils/log";

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

router.post("/updateRating", checkJwt, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.user;
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneOrFail({
      where: { id: userId },
      relations: ["accounts"],
    });
    if (user.monad_games_id) {
      if (!Helper.validateOrigin(req)) {
        return res.status(403).json({ error: "Forbidden: Invalid origin" });
      }
      if(user.updateRatingCalls == 0) {
        return res.status(422).json({ error: "The user has reached the rating update limit" });
      }
      const clientIp =
        req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown";

      const rateLimitResult = rateLimit(clientIp, {
        maxRequests: 10,
        windowMs: 60000,
      });

      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          error: "Too many requests",
          resetTime: rateLimitResult.resetTime,
        });
      }

      const { playerAddress, scoreAmount, transactionAmount } = {
        playerAddress: user.accounts.filter((x) => x.provider == "monad").pop()
          ?.providerUserId,
        scoreAmount: user.rating,
        transactionAmount: user.puzzleRating,
      };

      if (!playerAddress || !isValidAddress(playerAddress)) {
        return res.status(400).json({ error: "Invalid player address format" });
      }

      const requestId = generateRequestId(
        playerAddress,
        scoreAmount,
        transactionAmount
      );
      if (isDuplicateRequest(requestId)) {
        return res.status(409).json({
          error: "Duplicate request detected. Please wait before retrying.",
        });
      }

      markRequestProcessing(requestId);

      const result = await updatePlayerData(
        playerAddress,
        scoreAmount,
        transactionAmount
      );

      markRequestComplete(requestId);

      user.updateRatingCalls -= 1;
      await userRepo.save(user);

      return res.status(200).json({
        success: true,
        result,
        message: "Player data updated successfully",
      });
    } else {
      return res.status(422).json({
        message: "Register by monad game id",
      });
    }
  } catch (error) {
    logger.error("profile games error", error);
    if(error instanceof Error) {
      if (error.message.includes('insufficient funds')) {
        return res.status(400).json(
          { error: 'Insufficient funds to complete transaction' },
        );
      }
      if (error.message.includes('execution reverted')) {
        return res.status(400).json(
          { error: 'Contract execution failed - check if wallet has GAME_ROLE permission' },
        );
      }
      if (error.message.includes('AccessControlUnauthorizedAccount')) {
        return res.status(400).json(
          { error: 'Unauthorized: Wallet does not have GAME_ROLE permission' },
        );
      }
    }
    res.status(500).json({
      success: false,
      error: { code: "ServerError", message: "Server error" },
    });
  }
});

export default router;
