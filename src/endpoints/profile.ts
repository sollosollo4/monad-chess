import express from "express";
import { checkJwt, AuthRequest } from "../middleware/auth";
import { verifyMessage, ethers } from "ethers";
import { AppDataSource } from "../config/database";
import { User } from "../entity/User";

const router = express.Router();
router.post("/me", checkJwt, async (req: AuthRequest, res) => {
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

export default router;
