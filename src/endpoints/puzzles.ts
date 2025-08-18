import express from "express";
import { Request, Response } from "express";
import { Puzzle } from "../entity/Puzzle";
import { Chess } from "chess.js";
import { AppDataSource } from "../config/database";

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
  const puzzleRepo = AppDataSource.getRepository(Puzzle);
  const count = await puzzleRepo.count();
  if (count === 0) {
    return res.status(404).json({ error: "No puzzles in database" });
  }

  const randomOffset = Math.floor(Math.random() * count);
  const puzzle = await puzzleRepo.find({
    skip: randomOffset,
    take: 1,
  });

  return res.json(puzzle);
});

// Проверить решение

router.post("/check", async (req: Request, res: Response) => {
  const puzzleRepo = AppDataSource.getRepository(Puzzle);
  const { id, moves } = req.body;

  if (!id || !moves || !Array.isArray(moves)) {
    return res.status(400).json({ error: "id and moves[] are required" });
  }

  const puzzle = await puzzleRepo.findOneBy({ id });
  if (!puzzle) {
    return res.status(404).json({ error: "Puzzle not found" });
  }

  try {
    const chess = new Chess(puzzle.fen);

    for (let i = 0; i < moves.length; i++) {
      let move = null;

      if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(moves[i])) {
        const from = moves[i].slice(0, 2);
        const to = moves[i].slice(2, 4);
        const promotion = moves[i].length === 5 ? moves[i][4] : undefined;

        move = chess.move({ from, to, promotion });
      } else {
        move = chess.move(moves[i]);
      }

      if (!move) {
        return res.json({ correct: false, message: `Invalid move: ${moves[i]}` });
      }
    }

    const correct =
      JSON.stringify(moves) === JSON.stringify(puzzle.solution);

    return res.json({ correct });
  } catch (err) {
    return res.status(500).json({
      error: "Internal error",
      details: (err as Error).message,
    });
  }
});

export default router;