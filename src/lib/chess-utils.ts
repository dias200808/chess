import { Chess, type Move, type Square } from "chess.js";
import { getBotProfile } from "@/lib/bot-profiles";
import type { BotDifficulty, GameAnalysis, GameResult, SavedGame } from "@/lib/types";

const PIECE_VALUE: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

const CENTER_SQUARES = new Set(["d4", "e4", "d5", "e5", "c3", "f3", "c6", "f6"]);
const EXTENDED_CENTER = new Set([
  "c3",
  "d3",
  "e3",
  "f3",
  "c4",
  "d4",
  "e4",
  "f4",
  "c5",
  "d5",
  "e5",
  "f5",
  "c6",
  "d6",
  "e6",
  "f6",
]);
const MAX_BRANCHING_MOVES = 30;

export function summarizeMoveTypes(evaluations: GameAnalysis["evaluations"]) {
  const order = [
    "brilliant",
    "best move",
    "excellent",
    "good move",
    "inaccuracy",
    "mistake",
    "blunder",
    "missed win",
    "checkmate",
  ] satisfies GameAnalysis["evaluations"][number]["type"][];

  return order
    .map((type) => ({
      type,
      count: evaluations.filter((item) => item.type === type).length,
    }))
    .filter((item) => item.count > 0);
}

export function moveTypeLabel(type: GameAnalysis["evaluations"][number]["type"]) {
  switch (type) {
    case "brilliant":
      return "Бриллиант";
    case "best move":
      return "Лучший";
    case "excellent":
      return "Отличный";
    case "good move":
      return "Хороший";
    case "inaccuracy":
      return "Неточность";
    case "mistake":
      return "Ошибка";
    case "blunder":
      return "Зевок";
    case "missed win":
      return "Упущенная победа";
    case "checkmate":
      return "Мат";
    default:
      return type;
  }
}

export function classifyMoveQuality({
  centipawnLoss,
  isBest,
  sideAdvantage,
  materialSwing,
  playedSan,
}: {
  centipawnLoss: number;
  isBest: boolean;
  sideAdvantage: number;
  materialSwing: number;
  playedSan: string;
}): GameAnalysis["evaluations"][number]["type"] {
  if (playedSan.includes("#")) return "checkmate";
  if (sideAdvantage > 450 && centipawnLoss >= 251) return "missed win";
  if (isBest && materialSwing <= -250 && centipawnLoss <= 20) return "brilliant";
  if (isBest && centipawnLoss <= 20) return "best move";
  if (centipawnLoss <= 20) return "excellent";
  if (centipawnLoss <= 60) return "good move";
  if (centipawnLoss <= 120) return "inaccuracy";
  if (centipawnLoss <= 250) return "mistake";
  return "blunder";
}

export function getGameResult(chess: Chess): {
  result: GameResult;
  winner: SavedGame["winner"];
  label: string;
} {
  if (chess.isCheckmate()) {
    const winner = chess.turn() === "w" ? "black" : "white";
    return {
      result: winner === "white" ? "1-0" : "0-1",
      winner,
      label: `Мат. Победили ${winner === "white" ? "белые" : "черные"}.`,
    };
  }

  if (chess.isStalemate()) {
    return { result: "1/2-1/2", winner: "draw", label: "Ничья патом." };
  }

  if (chess.isInsufficientMaterial()) {
    return { result: "1/2-1/2", winner: "draw", label: "Ничья: недостаточно материала." };
  }

  if (chess.isThreefoldRepetition()) {
    return { result: "1/2-1/2", winner: "draw", label: "Ничья: повторение позиции." };
  }

  if (chess.isDraw()) {
    const halfmoveClock = Number(chess.fen().split(" ")[4] ?? 0);
    return {
      result: "1/2-1/2",
      winner: "draw",
      label: halfmoveClock >= 100 ? "Ничья: правило 50 ходов." : "Ничья.",
    };
  }

  return {
    result: "*",
    winner: null,
    label: chess.isCheck()
      ? `Ход ${chess.turn() === "w" ? "белых" : "черных"}, шах.`
      : `Ход ${chess.turn() === "w" ? "белых" : "черных"}.`,
  };
}

export function materialScore(fen: string) {
  const chess = new Chess(fen);
  let score = 0;

  for (const rank of chess.board()) {
    for (const piece of rank) {
      if (!piece) continue;
      const value = PIECE_VALUE[piece.type];
      score += piece.color === "w" ? value : -value;
    }
  }

  return score;
}

function evaluatePosition(chess: Chess) {
  if (chess.isCheckmate()) return chess.turn() === "w" ? -100000 : 100000;
  if (chess.isDraw()) return 0;

  let score = 0;

  for (const rank of chess.board()) {
    for (const piece of rank) {
      if (!piece) continue;
      const sign = piece.color === "w" ? 1 : -1;
      const value = PIECE_VALUE[piece.type];
      score += sign * value;
      if (CENTER_SQUARES.has(piece.square)) score += sign * 22;
      else if (EXTENDED_CENTER.has(piece.square)) score += sign * 10;

      const attackers = chess.attackers(piece.square, piece.color === "w" ? "b" : "w");
      const defenders = chess.attackers(piece.square, piece.color);
      if (attackers.length && !defenders.length && piece.type !== "k") {
        score -= sign * Math.round(value * 0.42);
      }
    }
  }

  const turn = chess.turn();
  const legalMoves = chess.moves({ verbose: true });
  const mobilityBonus = Math.min(legalMoves.length, 40) * 2;
  score += turn === "w" ? mobilityBonus : -mobilityBonus;

  if (chess.isCheck()) {
    score += turn === "w" ? -45 : 45;
  }

  for (const move of legalMoves) {
    const sign = move.color === "w" ? 1 : -1;
    if (move.san.includes("#")) score += sign * 100000;
    else if (move.san.includes("+")) score += sign * 35;
  }

  return score;
}

function makeMove(chess: Chess, move: Move) {
  chess.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" });
}

function movePriority(move: Move) {
  let priority = 0;
  if (move.san.includes("#")) priority += 100000;
  if (move.san.includes("+")) priority += 800;
  if (move.isCapture()) {
    const capturedValue = move.captured ? PIECE_VALUE[move.captured] : 0;
    const attackerValue = PIECE_VALUE[move.piece];
    priority += 5000 + capturedValue - attackerValue / 10;
  }
  if (move.isPromotion()) priority += 2000;
  if (CENTER_SQUARES.has(move.to)) priority += 60;
  return priority;
}

function orderedMoves(chess: Chess) {
  return chess
    .moves({ verbose: true })
    .sort((a, b) => movePriority(b) - movePriority(a))
    .slice(0, MAX_BRANCHING_MOVES);
}

function minimax(chess: Chess, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || chess.isGameOver()) return evaluatePosition(chess);

  const isWhiteToMove = chess.turn() === "w";
  const moves = orderedMoves(chess);

  if (isWhiteToMove) {
    let best = -Infinity;
    for (const move of moves) {
      makeMove(chess, move);
      best = Math.max(best, minimax(chess, depth - 1, alpha, beta));
      chess.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    makeMove(chess, move);
    best = Math.min(best, minimax(chess, depth - 1, alpha, beta));
    chess.undo();
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function scoreProfileMove(fen: string, move: Move, depth: number) {
  const chess = new Chess(fen);
  const botColor = chess.turn();
  makeMove(chess, move);
  const score =
    depth <= 1 ? evaluatePosition(chess) : minimax(chess, depth - 1, -Infinity, Infinity);
  const perspectiveScore = botColor === "w" ? score : -score;

  return perspectiveScore + movePriority(move) / 1000;
}

function randomChoice<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomMoveOrBest<T>(items: T[], fallback: T) {
  return items.length ? randomChoice(items) : fallback;
}

export function chooseBotMove(fen: string, difficulty: BotDifficulty) {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (!moves.length) return null;
  const profile = getBotProfile(difficulty);

  if (profile.depth === 0) {
    const tacticalMoves = moves.filter(
      (move) => move.isCapture() || move.san.includes("+") || move.san.includes("#"),
    );
    if (tacticalMoves.length && Math.random() < profile.tacticalBias) {
      return randomChoice(tacticalMoves);
    }
    return randomChoice(moves);
  }

  const scoredMoves = orderedMoves(chess)
    .map((move) => ({
      move,
      score: scoreProfileMove(fen, move, profile.depth),
    }))
    .sort((a, b) => b.score - a.score);

  if (Math.random() < profile.blunderChance) {
    return randomMoveOrBest(
      scoredMoves.slice(Math.ceil(scoredMoves.length * 0.55)).map((item) => item.move),
      scoredMoves[0].move,
    );
  }

  if (Math.random() < profile.mistakeChance) {
    return randomMoveOrBest(
      scoredMoves
        .slice(1, Math.max(2, Math.ceil(scoredMoves.length * 0.45)))
        .map((item) => item.move),
      scoredMoves[0].move,
    );
  }

  return scoredMoves[0].move;
}

export function squareTargets(fen: string, square: string) {
  try {
    const chess = new Chess(fen);
    return chess
      .moves({ square: square as Square, verbose: true })
      .map((move) => move.to);
  } catch {
    return [];
  }
}

export function analyzeMoves(moves: string[]): GameAnalysis {
  const chess = new Chess();
  const evaluations: GameAnalysis["evaluations"] = [];
  const penalties = { w: 0, b: 0 };

  moves.forEach((san, index) => {
    const fenBefore = chess.fen();
    const before = materialScore(chess.fen());
    const color = chess.turn();
    let move: Move | null = null;

    try {
      move = chess.move(san);
    } catch {
      return;
    }

    const after = materialScore(chess.fen());
    const delta = color === "w" ? after - before : before - after;
    const centipawnLoss = Math.max(0, -delta);
    const type = classifyMoveQuality({
      centipawnLoss,
      isBest: delta >= 120 || move.san.includes("#"),
      sideAdvantage: color === "w" ? before : -before,
      materialSwing: delta,
      playedSan: move.san,
    });

    const penalty =
      type === "blunder" || type === "missed win"
        ? 18
        : type === "mistake"
          ? 10
          : type === "inaccuracy"
            ? 5
            : 0;
    penalties[color] += penalty;

    evaluations.push({
      ply: index + 1,
      moveNumber: Math.floor(index / 2) + 1,
      color,
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion ?? ""}`,
      type,
      centipawnLoss,
      scoreBefore: before,
      scoreAfter: after,
      fenBefore,
      fenAfter: chess.fen(),
      engine: "heuristic",
      note:
        type === "checkmate"
          ? "Ход завершил партию матом."
          : type === "brilliant"
          ? "Сильная идея с тактической точностью или осознанной жертвой."
          : type === "blunder"
            ? "После этого хода позиция резко ухудшилась."
            : type === "mistake"
              ? "Ход допустимый, но дал сопернику серьезное улучшение."
              : type === "inaccuracy"
                ? "Играбельно, но был вариант заметно сильнее."
                : "Ход поддерживает качество позиции.",
    });
  });

  const worstMoment = [...evaluations]
    .filter((item) => ["blunder", "mistake", "missed win", "inaccuracy"].includes(item.type))
    .sort((a, b) => Math.abs(b.scoreAfter - b.scoreBefore) - Math.abs(a.scoreAfter - a.scoreBefore))[0];
  const bestMoment = [...evaluations]
    .filter((item) => ["checkmate", "brilliant", "best move", "excellent", "good move"].includes(item.type))
    .sort((a, b) => Math.abs(b.scoreAfter - b.scoreBefore) - Math.abs(a.scoreAfter - a.scoreBefore))[0];
  const keyMoments = evaluations
    .filter((item) => ["checkmate", "blunder", "mistake", "missed win"].includes(item.type))
    .slice(0, 8);

  const whiteAccuracy = Math.max(35, 100 - penalties.w);
  const blackAccuracy = Math.max(35, 100 - penalties.b);

  return {
    whiteAccuracy,
    blackAccuracy,
    evaluations,
    bestMoment,
    worstMoment,
    keyMoments,
    trainingFocus: worstMoment
      ? "Тренируйте поиск ходов-кандидатов, тактику на висящие фигуры и проверку форсированных ответов."
      : "Продолжайте развивать дебютные принципы, безопасность короля и технику реализации.",
    summary: worstMoment
      ? `Ключевой перелом произошел на ходу ${worstMoment.moveNumber}: ${worstMoment.san}. Перед фиксацией хода стоило проверить форсированные ответы соперника.`
      : "Крупного тактического обвала не найдено. Улучшайте активность фигур и технику реализации преимущества.",
  };
}
