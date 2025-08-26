import { DataSource } from "typeorm";
import { ENV } from "../config/env";
import { User } from "../entity/User";
import { LinkedWallet } from "../entity/LinkedWallet";
import { Game } from "../entity/Game";
import { Room } from "../entity/Room";
import { Move } from "../entity/Move";
import { Puzzle } from "../entity/Puzzle";
import fs from "fs";
import { parse } from "csv-parse";
import path from "path";
import { logger } from "../utils/log";
import { MoveAnalysis } from "../entity/MoveAnalysis";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: ENV.database.host,
  port: ENV.database.port,
  username: ENV.database.username,
  password: ENV.database.password,
  database: ENV.database.database,
  entities: [User, Game, Room, Move, LinkedWallet, Puzzle, MoveAnalysis],
  synchronize: true, // В проде false и миграции
});

const PUZZLES_SRC = path.join(__dirname, "./data/lichess_db_puzzle.csv");

interface Row {
  PuzzleId: string;
  FEN: string;
  Moves: string;
  Rating: string;
  RatingDeviation?: string;
  Popularity?: string;
  NbPlays?: string;
  Themes?: string;
  GameUrl?: string;
  OpeningTags?: string;
}

export const initDb = async () => {
  try {
    await AppDataSource.initialize();
    logger.info("Database connected");
    // init puzzles
    const repo = AppDataSource.getRepository(Puzzle);
    const puzzles_count = await repo.count();
    if (puzzles_count === 0) {
      if (!fs.existsSync(PUZZLES_SRC)) {
        console.warn(`[preprocess] File not found: ${PUZZLES_SRC}. Skipping.`);
        return;
      }
      const parser = fs
        .createReadStream(PUZZLES_SRC)
        .pipe(parse({ columns: true, trim: true }));

      let count = 0;
      for await (const rec of parser as AsyncIterable<Row>) {
        const puzzle = repo.create({
          lichessId: rec.PuzzleId,
          fen: rec.FEN,
          solution: String(rec.Moves).split(" ").filter(Boolean), // UCI-мувы
          rating: rec.Rating ? Number(rec.Rating) : undefined,
          themes: rec.Themes ? rec.Themes.split(",") : undefined,
        });

        await repo.save(puzzle);
        count++;

        if (count % 1000 === 0) {
          logger.info(`Inserted ${count} puzzles...`);
        }
      }
    } else {
      logger.info(`Puzzles count: ${puzzles_count}`);
    }
  } catch (error) {
    logger.error(`DB init error, ${error}`);
  }
};
