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
      const expectedMove = puzzle.solution[i];
      const playerMove = moves[i];

      // если игрок сделал лишний ход или не совпадает с эталоном
      if (expectedMove !== playerMove) {
        return res.json({
          correct: false,
          step: i,
          expected: expectedMove,
          got: playerMove,
          message: "Wrong move at this step",
        });
      }

      // применяем ход на доске (чтобы chess.js мог валидировать)
      const from = playerMove.slice(0, 2);
      const to = playerMove.slice(2, 4);
      const promotion = playerMove.length === 5 ? playerMove[4] : undefined;

      const move = chess.move({ from, to, promotion });
      if (!move) {
        return res.json({
          correct: false,
          step: i,
          expected: expectedMove,
          got: playerMove,
          message: "Illegal move",
        });
      }
    }

    // если игрок дошёл до конца эталона
    const finished = moves.length === puzzle.solution.length;

    return res.json({
      correct: true,
      finished,
      nextMove: finished ? null : puzzle.solution[moves.length], // следующий ожидаемый ход
    });
  } catch (err) {
    return res.status(500).json({
      error: "Internal error",
      details: (err as Error).message,
    });
  }
});

export default router;
