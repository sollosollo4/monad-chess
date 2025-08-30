
import { MoveAnalysis } from "../entity/MoveAnalysis";
import LlmCommentaryService from "./llm";
import StockfishService from "./stockfish_service";
import { Game } from "../entity/Game";
import { AppDataSource } from "../config/database";

class AnalyzeService {
  private repo = AppDataSource.getRepository(MoveAnalysis);
  private gameRepo = AppDataSource.getRepository(Game);

  public async analyzeEventHandler(event: any) {
    const { before_fen, after_fen, from, to, promotion, gameId, username, sideToMove } = event;

    const move = `${from}${to}${promotion ?? ""}`;
    const analysis = await StockfishService.analyzeMoveDetailed(before_fen, after_fen, from, to, promotion);

    const commentary = await LlmCommentaryService.buildCommentary({
      language: "ru",
      playerName: username,
      sideToMove,
      lastMove: move,
      fenBefore: before_fen,
      fenAfter: analysis.fenAfter,
      evalBeforeCp: analysis.evalBeforeCp,
      evalAfterCp: analysis.evalAfterCp,
      bestResponse: analysis.bestMove,
      severity: analysis.severity,
      pv: analysis.pv,
      persona: "coach",
    });

    const game = await this.gameRepo.findOneByOrFail({ id: gameId });

    const record = this.repo.create({
      game,
      move,
      side: sideToMove,
      fenBefore: before_fen,
      fenAfter: analysis.fenAfter,
      evalBeforeCp: analysis.evalBeforeCp,
      evalAfterCp: analysis.evalAfterCp,
      bestResponse: analysis.bestMove,
      severity: analysis.severity,
      pv: analysis.pv,
      engineComment: "", // если хочешь сохранить "сухой" комментарий
      llmShort: commentary.short,
      llmHint: commentary.hint,
      llmTone: commentary.tone,
      llmTags: commentary.tags,
    });

    await this.repo.save(record);
  }
}

export default new AnalyzeService();