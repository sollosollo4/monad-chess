import express from "express";
import { Request, Response } from "express";
import { Puzzle } from "../entity/Puzzle";
import { Chess } from "chess.js";
import { AppDataSource } from "../config/database";
import {
  AuthRequest,
  optionalAuthMiddleware,
} from "../middleware/auth_optional";
import { User } from "../entity/User";
import { checkJwt } from "../middleware/auth";
import LlmPuzzleService from "../services/llm_puzzle_service";

const router = express.Router();

router.get('/greetings', checkJwt, async(req: AuthRequest, res: Response) => {
  const greeting = await LlmPuzzleService.greetPlayer(req.user?.username);
  return res.json({
    greeting
  });
});

router.get(
  "/random",
  checkJwt,
  async (req: AuthRequest, res: Response) => {
    const puzzleRepo = AppDataSource.getRepository(Puzzle);
    let min = 0;
    let max = 3316;
    if (req.user) {
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOneBy({ id: req.user.userId });
      if (!user || !user.puzzleRating) {
        return res.status(400).json({ error: "User puzzleRating not set" });
      }
      const rating = user.puzzleRating;
      min = Math.max(rating - 50, 0);
      max = rating + 50;
    } else {
      min = 0;
      max = 500;
    }
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

    let instruction;
    if(puzzle.themes)
      instruction = await LlmPuzzleService.puzzleInstruction(puzzle.themes);

    return res.json({
      puzzle,
      instruction
    });
  }
);

router.post("/check", checkJwt, async (req: AuthRequest, res: Response) => {
  const puzzleRepo = AppDataSource.getRepository(Puzzle);
  const { id, move, step } = req.body;
  let new_rating = 0;

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
      if(req.user?.userId) {
        new_rating = await updateRating(req.user?.userId, -2);
      }
      return res.json({
        correct: false,
        finished: false,
        step,
        expected: expectedMove,
        got: move,
        message: "Wrong move at this step",
        new_rating,
        rating_change: -2
      });
    }

    const from = move.slice(0, 2);
    const to = move.slice(2, 4);
    const promotion = move.length === 5 ? move[4] : undefined;

    const applied = chess.move({ from, to, promotion });
    if (!applied) {
      if (req.user?.userId) {
        new_rating = await updateRating(req.user?.userId, -2);
      }
      return res.json({
        correct: false,
        finished: false,
        step,
        expected: expectedMove,
        got: move,
        message: "Illegal move",
        new_rating,
        rating_change: -2
      });
    }

    const finished = step + 1 === puzzle.solution.length;
    const nextMove = finished ? null : puzzle.solution[step + 1];

    

    if (finished && req.user?.userId) {
      new_rating = await updateRating(req.user?.userId, 10);
    }

    return res.json({
      correct: true,
      finished,
      nextMove,
      new_rating,
      rating_change: 10
    });
  } catch (err) {
    return res.status(500).json({
      error: "Internal error",
      details: (err as Error).message,
    });
  }
});

async function updateRating(userId: number, delta: number) {
  const { raw } = await AppDataSource
    .getRepository(User)
    .createQueryBuilder()
    .update(User)
    .set({ puzzleRating: () => `"puzzleRating" + ${delta}` })
    .where("id = :id", { id: userId })
    .returning("puzzleRating")
    .execute();

  return raw[0].puzzleRating as number;
}

export default router;
