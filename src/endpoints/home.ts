import express from "express";
import { checkJwt, AuthRequest } from "../middleware/auth";
import { AppDataSource } from "../config/database";
import { UserExperience } from "../entity/UserExperience";

const router = express.Router();

router.get("/leaderboard", checkJwt, async (req: AuthRequest, res) => {
  try {
    const expRepo = AppDataSource.getRepository(UserExperience);

    const leaderboard = await expRepo
      .createQueryBuilder("exp")
      .select("user.id", "userId")
      .addSelect("user.username", "username")
      .addSelect("SUM(exp.amount)", "totalXp")
      .innerJoin("exp.user", "user")
      .where("user.monad_games_id IS NOT NULL")
      .andWhere("exp.submitted = :submitted", { submitted: true })
      .groupBy("user.id")
      .addGroupBy("user.username")
      .orderBy("SUM(exp.amount)", "DESC")
      .getRawMany();

    res.json({
      success: true,
      leaderboard,
    });
  } catch (err) {
    console.error("profile experience error", err);
    res.status(500).json({
      success: false,
      error: { code: "ServerError", message: "Server error" },
    });
  }
});

export default router;
