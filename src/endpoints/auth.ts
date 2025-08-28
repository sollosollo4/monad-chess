import express from "express";
import { User } from "../entity/User";
import { LinkedAccount } from "../entity/LinkedAccount";
import { checkJwt, AuthRequest } from "../middleware/auth";
import { AppDataSource } from "../config/database";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";

const router = express.Router();

router.post("/login-global", async (req, res) => {
  const userRepo = AppDataSource.getRepository(User);
  const accountRepo = AppDataSource.getRepository(LinkedAccount);

  try {
    const { provider, providerUserId, providerAppId } = req.body;
    if (!provider || !providerUserId) {
      return res
        .status(400)
        .json({ message: "provider и providerUserId обязательны" });
    }

    // Проверяем, есть ли такой аккаунт
    const existsAccount = await accountRepo.findOne({
      where: { provider, providerUserId, providerAppId },
      relations: ["user"],
    });

    let user: User;
    if (existsAccount) {
      user = existsAccount.user;
    } else {
      // если provider = "wallet" → проверка Monad API (как раньше)
      if (provider === "monad") {
        const checkRes = await fetch(
          `https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${encodeURIComponent(
            providerUserId
          )}`,
          { headers: { "Content-Type": "application/json" } }
        );
        if (!checkRes.ok) {
          throw new Error(`Monad ID API error: ${checkRes.status}`);
        }

        const json = await checkRes.json();

        if (json.hasUsername && json.user) {
          const tryGetUser = await userRepo.findOne({
            where: { username: json.user.username },
            relations: ["accounts"],
          });
          if (!tryGetUser) {
            user = userRepo.create({
              username: json.user.username,
              monad_games_id: true,
            });
            await userRepo.save(user);
          } else {
            user = tryGetUser;
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
      } else {
        // для соцсетей создаём нового пользователя
        const last = await userRepo
          .createQueryBuilder("u")
          .orderBy("u.id", "DESC")
          .getOne();
        const newId = last ? last.id + 1 : 1;
        user = userRepo.create({
          username: `${provider}_user${newId.toString().padStart(4, "0")}`,
          monad_games_id: false,
        });
        await userRepo.save(user);
      }

      // создаём связь
      const account = accountRepo.create({
        provider,
        providerUserId,
        providerAppId,
        user,
      });
      await accountRepo.save(account);
    }

    const token = generateAccessToken({ userId: user.id });
    const refreshToken = generateRefreshToken({ userId: user.id });

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
        accounts: user.accounts,
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

router.post("/link-account", checkJwt, async (req: AuthRequest, res) => {
  const { provider, providerUserId, providerAppId } = req.body;
  const userId = req.user.userId!;
  const userRepo = AppDataSource.getRepository(User);
  const accountRepo = AppDataSource.getRepository(LinkedAccount);

  const user = await userRepo.findOne({
    where: { id: userId },
    relations: ["accounts"],
  });
  if (!user) return res.status(404).json({ message: "User not found" });

  if (
    user.accounts.some(
      (a) => a.provider === provider && a.providerUserId === providerUserId
    )
  ) {
    return res.json({ message: "Already linked" });
  }

  const account = accountRepo.create({
    provider,
    providerUserId,
    providerAppId,
    user,
  });
  await accountRepo.save(account);

  res.json({ message: "Account linked", accounts: user.accounts ?? [] });
});

export default router;
