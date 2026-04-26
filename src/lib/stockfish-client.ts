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
  return turn === "w" ? score : -score;
}

export function getStockfishBestMove(
  fen: string,
  options: StockfishSearchOptions = {},
): Promise<StockfishResult | null> {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const worker = new Worker(ENGINE_PATH);
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
  const penalties = { w: 0, b: 0 };

  for (let index = 0; index < moves.length; index += 1) {
    const beforeFen = chess.fen();
    const side = chess.turn();
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

    const beforeScore = before ? scoreToWhitePerspective(before, beforeFen) : 0;
    const afterScore = after ? scoreToWhitePerspective(after, afterFen) : 0;
    const centipawnLoss =
      side === "w"
        ? Math.max(0, beforeScore - afterScore)
        : Math.max(0, afterScore - beforeScore);
    const sideAdvantage = side === "w" ? beforeScore : -beforeScore;
    const isBest = before?.bestMove === playedUci;
    const type = classifyMoveQuality({
      centipawnLoss,
      isBest,
      sideAdvantage,
      materialSwing,
      playedSan: playedMove.san,
    });

    const penalty =
      type === "blunder" || type === "missed win"
        ? 18
        : type === "mistake"
          ? 10
          : type === "inaccuracy"
            ? 5
            : 0;
    penalties[side] += penalty;

    evaluations.push({
      moveNumber: Math.floor(index / 2) + 1,
      san: playedMove.san,
      type,
      centipawnLoss,
      scoreBefore: beforeScore,
      scoreAfter: afterScore,
      bestMove: before?.bestMoveSan ?? before?.bestMove,
      engine: "stockfish",
      note:
        type === "brilliant"
          ? "Движок подтверждает сильную тактическую идею или качественную жертву."
          : isBest
            ? "Stockfish подтверждает этот ход как лучший."
            : `Движок предпочитал ${before?.bestMoveSan ?? before?.bestMove ?? "другой ход"}. Потеря: ${centipawnLoss} cp.`,
    });

    options.onProgress?.(index + 1, moves.length);
  }

  const worstMoment = [...evaluations]
    .filter((item) => ["blunder", "mistake", "missed win", "inaccuracy"].includes(item.type))
    .sort((a, b) => Math.abs(b.scoreAfter - b.scoreBefore) - Math.abs(a.scoreAfter - a.scoreBefore))[0];
  const bestMoment = evaluations.find((item) => item.type === "best move");

  return {
    whiteAccuracy: Math.max(20, 100 - penalties.w),
    blackAccuracy: Math.max(20, 100 - penalties.b),
    evaluations,
    bestMoment,
    worstMoment,
    trainingFocus: worstMoment
      ? `Пересмотрите ход ${worstMoment.moveNumber}. Сравните свое решение с ${worstMoment.bestMove ?? "линией движка"} и потренируйте поиск кандидатов.`
      : "Stockfish не нашел крупной ошибки. Продолжайте тренировать реализацию преимущества и профилактику.",
    summary: worstMoment
      ? `Stockfish: главный перелом был на ходу ${worstMoment.moveNumber} (${worstMoment.san}). ${worstMoment.note}`
      : "Stockfish: партия прошла ровно, без крупного тактического провала.",
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
