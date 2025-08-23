import express from "express";
import jwt from "jsonwebtoken";
import { User } from "../entity/User";
import { LinkedWallet } from "../entity/LinkedWallet";
import { checkJwt, AuthRequest } from "../middleware/auth";
import { AppDataSource } from "../config/database";
import { ENV } from "../config/env";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";

const router = express.Router();

router.post("/login-global", async (req, res) => {
  const userRepo = AppDataSource.getRepository(User);
  const walletRepo = AppDataSource.getRepository(LinkedWallet);

  try {
    const { address, providerAppId } = req.body;
    if (!address || !providerAppId) {
      return res
        .status(400)
        .json({ message: "address и providerAppId обязательны" });
    }

    const checkRes = await fetch(
      `https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${encodeURIComponent(
        address
      )}`,
      { headers: { "Content-Type": "application/json" } }
    );
    if (!checkRes.ok) {
      throw new Error(`Monad ID API error: ${checkRes.status}`);
    }

    const json = (await checkRes.json()) as {
      hasUsername: boolean;
      user: { id: number; username: string; walletAddress: string } | null;
    };

    const existsAddress = await walletRepo.findOne({
      where: { address },
      relations: ["user"],
    });

    let user: User | null = null;
    if (existsAddress) {
      user = existsAddress.user;
    } else {
      if (json.hasUsername && json.user) {
        user = await userRepo.findOne({
          where: { username: json.user.username },
          relations: ["wallets"],
        });
        if (!user) {
          user = userRepo.create({
            username: json.user.username,
            monad_games_id: true,
          });
          await userRepo.save(user);
        }
      } else {
        const last = await userRepo
          .createQueryBuilder("u")
          .orderBy("u.id", "DESC")
          .getOne();
        const newId = last ? last.id + 1 : 1;
        user = userRepo.create({
          username: `MonadChessUser${newId.toString().padStart(4, "0")}`,
          monad_games_id: false,
        });
        await userRepo.save(user);
      }
    }
    const existsWallet = await walletRepo.findOne({
      where: { address, providerAppId },
      relations: ["user"],
    });

    if (!existsWallet) {
      const wallet = walletRepo.create({ address, providerAppId, user });
      await walletRepo.save(wallet);
    }

    const token = generateAccessToken({
      userId: user.id,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        wallets: user.wallets,
        monad_games_id: user.monad_games_id,
        rating: user.rating,
        puzzle_rating: user.puzzleRating,
      },
    });
  } catch (err: any) {
    console.error("Login-global error:", err);
    res.status(500).json({ message: err.message ?? "Internal error" });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token;

    if (!refreshToken) {
      return res.fail("Unauthorized", "No refresh token", 401);
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      return res.fail("Unauthorized", "Invalid refresh token", 401);
    }
    const accessToken = generateAccessToken(payload);

    res.success({
      success: true,
      token: accessToken,
      userId: payload.userId,
      payload,
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: { code: "ServerError", message: "Server error" },
    });
  }
});

router.post("/link-wallet", checkJwt, async (req: AuthRequest, res) => {
  const { address, providerAppId } = req.body;
  const userId = req.user.userId!;
  const userRepo = AppDataSource.getRepository(User);
  const walletRepo = AppDataSource.getRepository(LinkedWallet);

  const user = await userRepo.findOne({
    where: { id: userId },
    relations: ["wallets"],
  });
  if (!user) return res.status(404).json({ message: "User not found" });

  if (
    user.wallets.some(
      (w) => w.address === address && w.providerAppId === providerAppId
    )
  ) {
    return res.json({ message: "Already linked" });
  }

  const wallet = walletRepo.create({ address, providerAppId, user });
  await walletRepo.save(wallet);

  res.json({ message: "Wallet linked", wallets: user.wallets.concat(wallet) });
});

export default router;
