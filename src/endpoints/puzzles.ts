import express from "express";
import { Request, Response } from "express";
import { Puzzle } from "../entity/Puzzle";
import { Chess } from "chess.js";
import { AppDataSource } from "../config/database";

const router = express.Router();

router.get("/random", async (req: Request, res: Response) => {
  const { minRating, maxRating } = req.query;
  const puzzleRepo = AppDataSource.getRepository(Puzzle);

  const min = minRating ? Number(minRating) : 0;
  const max = maxRating ? Number(maxRating) : 9999;
  if (min > max) {
    return res
      .status(400)
      .json({ error: "`minRating` must be <= `maxRating`" });
  }

  const puzzle = await puzzleRepo
    .createQueryBuilder("p")
    .where("p.rating BETWEEN :min AND :max", { min, max })
    .orderBy("RANDOM()")
    .limit(1)
    .getOne();

  if (!puzzle) {
    return res.status(404).json({ error: "No puzzle found in range" });
  }

  return res.json(puzzle);
});

router.post("/check", async (req: Request, res: Response) => {
  const puzzleRepo = AppDataSource.getRepository(Puzzle);
  const { id, move, step } = req.body;

  if (!id || !move || typeof step !== "number") {
    return res.status(400).json({ error: "id, move and step are required" });
  }

  const puzzle = await puzzleRepo.findOneBy({ id });
  if (!puzzle) {
    return res.status(404).json({ error: "Puzzle not found" });
  }

  try {
    const chess = new Chess(puzzle.fen);

    for (let i = 0; i < step; i++) {
      const prevMove = puzzle.solution[i];
      const from = prevMove.slice(0, 2);
      const to = prevMove.slice(2, 4);
      const promotion = prevMove.length === 5 ? prevMove[4] : undefined;
      chess.move({ from, to, promotion });
    }

    const expectedMove = puzzle.solution[step];
    if (move !== expectedMove) {
      return res.json({
        correct: false,
        step,
        expected: expectedMove,
        got: move,
        message: "Wrong move at this step",
      });
    }

    const from = move.slice(0, 2);
    const to = move.slice(2, 4);
    const promotion = move.length === 5 ? move[4] : undefined;

    const applied = chess.move({ from, to, promotion });
    if (!applied) {
      return res.json({
        correct: false,
        step,
        expected: expectedMove,
        got: move,
        message: "Illegal move",
      });
    }

    const finished = step + 1 === puzzle.solution.length;
    const nextMove = finished ? null : puzzle.solution[step + 1];

    return res.json({
      correct: true,
      finished,
      nextMove,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Internal error",
      details: (err as Error).message,
    });
  }
});

export default router;
