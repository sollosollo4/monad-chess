import { Router } from "express";
import { Room, RoomMode, Side } from "../entity/Room";
import { AppDataSource } from "../config/database";
import { optionalAuthMiddleware } from "../middleware/auth_optional";
import { AuthRequest } from "../middleware/auth";
import { User } from "../entity/User";

const router = Router();

function genCode(len = 6) {
  return Math.random().toString(36).substr(2, len).toUpperCase();
}

router.post("/create", optionalAuthMiddleware, async (req: AuthRequest, res) => {
  const repo = AppDataSource.getRepository(Room);
  let code = genCode();
  while (await repo.findOne({ where: { code } })) code = genCode();
  const { mode, side, name: nameFromBody, botRating } = req.body;
  
  let name: string;
  if (req.user?.userId) {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneOrFail({ where: { id: req.user.userId } });
    name = user.username;
  } else {
    name = nameFromBody;
  }

  const validModes = ["pvp", "bot"];
  const validSides = ["white", "black", "random"];

  if (mode && !validModes.includes(mode)) {
    return res.status(400).json({ error: "Invalid mode. Use 'pvp' or 'bot'." });
  }

  if (side && !validSides.includes(side)) {
    return res
      .status(400)
      .json({ error: "Invalid side. Use 'white', 'black' or 'random'." });
  }

  const room = repo.create({
    code,
    name: name,
    mode: (mode as RoomMode) || "pvp",
    adminSide: (side as Side) || "random",
  });
  await repo.save(room);
  res.json({ code: room.code });
});

router.get("/:code", async (req, res) => {
  const repo = AppDataSource.getRepository(Room);
  const room = await repo.findOne({ where: { code: req.params.code } });
  if (!room) return res.status(404).json({ error: "not found" });
  res.json({ id: room.id, code: room.code, name: room.name });
});

export default router;

