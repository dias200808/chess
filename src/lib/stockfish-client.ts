import { Chess } from "chess.js";
import type { GameAnalysis, MoveEvaluation } from "@/lib/types";
import { classifyMoveQuality } from "@/lib/chess-utils";

const ENGINE_PATH = "/stockfish/stockfish-18-lite-single.js";

export type StockfishSearchOptions = {
  depth?: number;
  moveTime?: number;
  elo?: number;
  timeout?: number;
};

export type StockfishAnalysisOptions = {
  onProgress?: (done: number, total: number) => void;
  beforeDepth?: number;
  afterDepth?: number;
  beforeMoveTime?: number;
  afterMoveTime?: number;
  timeout?: number;
};

export type StockfishResult = {
  bestMove: string;
  bestMoveSan?: string;
  scoreCp?: number;
  mate?: number;
  pv: string[];
};

function moveToUci(move: { from: string; to: string; promotion?: string }) {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function clampEvaluation(score: number) {
  return Math.max(-100000, Math.min(100000, score));
}

function uciToSan(fen: string, uci: string) {
  const chess = new Chess(fen);
  const move = chess
    .moves({ verbose: true })
    .find((item) => moveToUci(item) === uci || `${item.from}${item.to}` === uci);
  return move?.san;
}

function scoreToCentipawns(result: StockfishResult) {
  if (typeof result.mate === "number") {
    return result.mate > 0 ? 100000 - result.mate * 1000 : -100000 - result.mate * 1000;
  }

  return result.scoreCp ?? 0;
}

function scoreToWhitePerspective(result: StockfishResult, fen: string) {
  const score = scoreToCentipawns(result);
  const turn = new Chess(fen).turn();
  return clampEvaluation(turn === "w" ? score : -score);
}

function staticWhiteScore(chess: Chess) {
  if (chess.isCheckmate()) return chess.turn() === "w" ? -100000 : 100000;
  if (chess.isDraw()) return 0;
  let score = materialAt(chess.fen());
  const legalMoves = chess.moves({ verbose: true });
  score += (chess.turn() === "w" ? 1 : -1) * Math.min(legalMoves.length, 40) * 2;
  if (chess.isCheck()) score += chess.turn() === "w" ? -80 : 80;
  return score;
}

function staticBestMove(fen: string) {
  const chess = new Chess(fen);
  const side = chess.turn();
  const moves = chess.moves({ verbose: true });
  let best: { san: string; uci: string; score: number } | null = null;

  for (const move of moves) {
    const line = new Chess(fen);
    const played = line.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" });
    const score = staticWhiteScore(line);
    const better =
      !best || (side === "w" ? score > best.score : score < best.score);
    if (better) best = { san: played.san, uci: moveToUci(played), score };
  }

  return best;
}

function cpLossForSide(side: "w" | "b", beforeScore: number, afterScore: number) {
  return Math.round(
    side === "w"
      ? Math.max(0, beforeScore - afterScore)
      : Math.max(0, afterScore - beforeScore),
  );
}

function accuracyFromLosses(losses: number[]) {
  if (!losses.length) return 100;
  const averageLoss = losses.reduce((total, loss) => total + Math.min(loss, 1000), 0) / losses.length;
  return Math.round(Math.max(0, Math.min(100, 100 - averageLoss / 8)));
}

function formatCp(score: number) {
  if (Math.abs(score) >= 90000) return score > 0 ? "M" : "-M";
  const pawns = score / 100;
  return `${pawns > 0 ? "+" : ""}${pawns.toFixed(1)}`;
}

function coachNote({
  type,
  san,
  bestMove,
  centipawnLoss,
  beforeScore,
  afterScore,
}: {
  type: MoveEvaluation["type"];
  san: string;
  bestMove?: string;
  centipawnLoss: number;
  beforeScore: number;
  afterScore: number;
}) {
  if (type === "checkmate") return "Этот ход поставил мат и завершил партию.";
  if (type === "best move") return "Stockfish считает этот ход лучшим в позиции.";
  if (type === "excellent") return "Очень точный ход, оценка позиции почти не изменилась.";
  if (type === "good move") return "Нормальное практическое решение, но был чуть точнее вариант.";
  const better = bestMove ? ` Лучше было ${bestMove}.` : "";
  const swing = `${formatCp(beforeScore)} → ${formatCp(afterScore)}`;
  if (type === "blunder") {
    return `Ход ${san} резко ухудшил позицию (${swing}) и потерял около ${centipawnLoss} cp.${better}`;
  }
  if (type === "mistake") {
    return `После ${san} позиция заметно просела (${swing}).${better}`;
  }
  if (type === "missed win") {
    return `Здесь был шанс удержать выигранную позицию, но ${san} выпустил большое преимущество.${better}`;
  }
  return `Ход неточный: оценка изменилась ${swing}.${better}`;
}

export function getStockfishBestMove(
  fen: string,
  options: StockfishSearchOptions = {},
): Promise<StockfishResult | null> {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(ENGINE_PATH);
    } catch {
      resolve(null);
      return;
    }
    const timeout = window.setTimeout(() => {
      worker.terminate();
      resolve(null);
    }, options.timeout ?? 8000);
    const latest: StockfishResult = { bestMove: "", pv: [] };

    function finish(result: StockfishResult | null) {
      window.clearTimeout(timeout);
      worker.terminate();
      resolve(result);
    }

    worker.onmessage = (event: MessageEvent<string>) => {
      const line = String(event.data);

      if (line === "uciok") {
        worker.postMessage("setoption name Hash value 64");
        if (options.elo && options.elo < 3000) {
          worker.postMessage("setoption name UCI_LimitStrength value true");
          worker.postMessage(`setoption name UCI_Elo value ${Math.min(options.elo, 3190)}`);
        }
        worker.postMessage("isready");
        return;
      }

      if (line === "readyok") {
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(
          options.depth
            ? `go depth ${options.depth}`
            : `go movetime ${options.moveTime ?? 700}`,
        );
        return;
      }

      const scoreMatch = line.match(/\bscore (cp|mate) (-?\d+)/);
      if (scoreMatch) {
        if (scoreMatch[1] === "cp") latest.scoreCp = Number(scoreMatch[2]);
        else latest.mate = Number(scoreMatch[2]);
      }

      const pvMatch = line.match(/\bpv\s+(.+)$/);
      if (pvMatch) latest.pv = pvMatch[1].trim().split(/\s+/);

      const bestMoveMatch = line.match(/^bestmove\s+(\S+)/);
      if (bestMoveMatch) {
        latest.bestMove = bestMoveMatch[1];
        latest.bestMoveSan = uciToSan(fen, latest.bestMove);
        finish(latest.bestMove === "(none)" ? null : latest);
      }
    };

    worker.onerror = () => finish(null);
    worker.postMessage("uci");
  });
}

export async function runStockfishGameAnalysis(
  moves: string[],
  options: StockfishAnalysisOptions = {},
): Promise<GameAnalysis> {
  const chess = new Chess();
  const evaluations: MoveEvaluation[] = [];
  const losses = { w: [] as number[], b: [] as number[] };

  for (let index = 0; index < moves.length; index += 1) {
    const beforeFen = chess.fen();
    const side = chess.turn();
    const staticBest = staticBestMove(beforeFen);
    const materialBefore = materialAt(beforeFen);
    const playedMove = chess.move(moves[index]);
    const afterFen = chess.fen();
    const playedUci = moveToUci(playedMove);
    const materialAfter = materialAt(afterFen);
    const materialSwing = side === "w" ? materialAfter - materialBefore : materialBefore - materialAfter;

    const before = await getStockfishBestMove(beforeFen, {
      depth: options.beforeDepth ?? 10,
      moveTime: options.beforeMoveTime ?? 400,
      timeout: options.timeout ?? 9000,
    });
    const after = await getStockfishBestMove(afterFen, {
      depth: options.afterDepth ?? 9,
      moveTime: options.afterMoveTime ?? 280,
      timeout: options.timeout ?? 9000,
    });

    const beforeScore = before
      ? scoreToWhitePerspective(before, beforeFen)
      : staticBest?.score ?? staticWhiteScore(new Chess(beforeFen));
    const afterScore = after
      ? scoreToWhitePerspective(after, afterFen)
      : staticWhiteScore(new Chess(afterFen));
    const stockfishLoss = cpLossForSide(side, beforeScore, afterScore);
    const staticLoss = staticBest
      ? cpLossForSide(side, staticBest.score, staticWhiteScore(new Chess(afterFen)))
      : 0;
    const centipawnLoss = Math.max(stockfishLoss, staticLoss);
    const sideAdvantage = side === "w" ? beforeScore : -beforeScore;
    const isBest = before?.bestMove === playedUci || staticBest?.uci === playedUci;
    const type = classifyMoveQuality({
      centipawnLoss,
      isBest,
      sideAdvantage,
      materialSwing,
      playedSan: playedMove.san,
    });
    losses[side].push(centipawnLoss);
    const bestMove = before?.bestMoveSan ?? staticBest?.san ?? before?.bestMove;

    evaluations.push({
      ply: index + 1,
      moveNumber: Math.floor(index / 2) + 1,
      color: side,
      san: playedMove.san,
      uci: playedUci,
      type,
      centipawnLoss,
      scoreBefore: beforeScore,
      scoreAfter: afterScore,
      mateBefore: before?.mate,
      mateAfter: after?.mate,
      bestMove,
      bestMoveUci: before?.bestMove ?? staticBest?.uci,
      fenBefore: beforeFen,
      fenAfter: afterFen,
      engine: before || after ? "stockfish" : "heuristic",
      note: coachNote({
        type,
        san: playedMove.san,
        bestMove,
        centipawnLoss,
        beforeScore,
        afterScore,
      }),
    });

    options.onProgress?.(index + 1, moves.length);
  }

  const worstMoment = [...evaluations]
    .filter((item) => ["blunder", "mistake", "missed win", "inaccuracy"].includes(item.type))
    .sort((a, b) => (b.centipawnLoss ?? 0) - (a.centipawnLoss ?? 0))[0];
  const bestMoment =
    evaluations.find((item) => item.type === "checkmate") ??
    evaluations.find((item) => item.type === "best move") ??
    evaluations.find((item) => item.type === "excellent");
  const keyMoments = evaluations
    .filter(
      (item) =>
        ["checkmate", "blunder", "mistake", "missed win"].includes(item.type) ||
        Math.abs(item.scoreAfter - item.scoreBefore) >= 250,
    )
    .sort((a, b) => (b.centipawnLoss ?? 0) - (a.centipawnLoss ?? 0))
    .slice(0, 10);

  return {
    whiteAccuracy: accuracyFromLosses(losses.w),
    blackAccuracy: accuracyFromLosses(losses.b),
    evaluations,
    bestMoment,
    worstMoment,
    keyMoments,
    trainingFocus: worstMoment
      ? `Тренируйте проверку угроз соперника перед ходом. В этой партии главный провал: ${worstMoment.moveNumber}. ${worstMoment.san}; лучше было ${worstMoment.bestMove ?? "сначала найти ход-кандидат движка"}.`
      : "Stockfish не нашел крупной ошибки. Продолжайте тренировать реализацию преимущества и профилактику.",
    summary: worstMoment
      ? `AI Coach: главный перелом был на ходу ${worstMoment.moveNumber}. Вы сыграли ${worstMoment.san}, и оценка изменилась ${formatCp(worstMoment.scoreBefore)} → ${formatCp(worstMoment.scoreAfter)}. ${worstMoment.bestMove ? `Лучше было ${worstMoment.bestMove}. ` : ""}${worstMoment.note}`
      : "AI Coach: партия прошла ровно, без крупного тактического провала. Главная задача — сохранять внимание к угрозам и не спешить в критических позициях.",
  };
}

function materialAt(fen: string) {
  const chess = new Chess(fen);
  const values: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  let score = 0;

  for (const rank of chess.board()) {
    for (const piece of rank) {
      if (!piece) continue;
      score += piece.color === "w" ? values[piece.type] : -values[piece.type];
    }
  }

  return score;
}
