import { Router } from "express";
import { Room } from "../entity/Room";
import { AppDataSource } from "../config/database";

const router = Router();

function genCode(len = 6) {
  return Math.random().toString(36).substr(2, len).toUpperCase();
}

router.post("/create", async (req, res) => {
  const repo = AppDataSource.getRepository(Room);
  let code = genCode();
  while (await repo.findOne({ where: { code } })) code = genCode();
  const room = repo.create({ code, name: req.body?.name || null });
  await repo.save(room);
  res.json({ code: room.code });
});

router.get("/:code", async (req, res) => {
  const repo = AppDataSource.getRepository(Room);
  const room = await repo.findOne({ where: { code: req.params.code }});
  if (!room) return res.status(404).json({ error: "not found" });
  res.json({ id: room.id, code: room.code, name: room.name });
});

export default router;