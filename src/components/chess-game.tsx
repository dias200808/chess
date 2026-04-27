"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Chess, type Square } from "chess.js";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Handshake,
  RotateCcw,
  Save,
  Search,
  ShieldOff,
  Shuffle,
  X,
} from "lucide-react";
import { getBotProfile } from "@/lib/bot-profiles";
import { START_FEN } from "@/lib/game-config";
import type { BotDifficulty, GameAnalysis, GameMode, SavedGame, TimeControl } from "@/lib/types";
import {
  analyzeMoves,
  chooseBotMove,
  getGameResult,
  moveTypeLabel,
  squareTargets,
  summarizeMoveTypes,
} from "@/lib/chess-utils";
import { getStockfishBestMove, runStockfishGameAnalysis } from "@/lib/stockfish-client";
import { getSettings, saveGame } from "@/lib/storage";
import { saveGameToSupabase } from "@/lib/supabase-data";
import { animationDuration, boardColors } from "@/lib/board-visuals";
import {
  calculateRatingChange,
  isRatedGame,
  ratingForProfile,
  ratingPatch,
  ratingTypeForTimeControl,
} from "@/lib/rating";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { Chessboard } from "@/components/client-chessboard";
import { Badge, Button, Card } from "@/components/ui";

function replay(moves: string[], initialFen?: string) {
  let chess: Chess;
  try {
    chess = initialFen ? new Chess(initialFen) : new Chess();
  } catch {
    chess = new Chess();
  }
  for (const move of moves) {
    try {
      chess.move(move);
    } catch {
      break;
    }
  }
  return chess;
}

function findMoveFromUci(chess: Chess, uci: string) {
  return chess
    .moves({ verbose: true })
    .find(
      (move) =>
        `${move.from}${move.to}${move.promotion ?? ""}` === uci ||
        `${move.from}${move.to}` === uci,
    );
}

function playTone(type: "move" | "capture" | "end") {
  if (typeof window === "undefined") return;
  if (!getSettings().sounds) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = type === "capture" ? 180 : type === "end" ? 520 : 320;
  gain.gain.value = 0.04;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.08);
}

function formatClock(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function initialClockState(timeControl: TimeControl) {
  if (timeControl.initialSeconds === null) return null;
  const base = timeControl.initialSeconds * 1000;
  return { white: base, black: base };
}

function isLowClock(ms?: number) {
  if (typeof ms !== "number") return false;
  return ms <= 10_000;
}

type PendingPromotion = {
  from: string;
  to: string;
  side: "white" | "black";
};

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export function ChessGame({
  mode = "local",
  playerColor = "white",
  difficulty = "elo-800",
  timeControl = {
    id: "unlimited",
    label: "No time",
    initialSeconds: null,
    incrementSeconds: 0,
  },
  initialFen,
}: {
  mode?: GameMode;
  playerColor?: "white" | "black";
  difficulty?: BotDifficulty;
  timeControl?: TimeControl;
  initialFen?: string;
}) {
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const [moves, setMoves] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<"white" | "black">(playerColor);
  const [hoverSquare, setHoverSquare] = useState<string | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [resignedBy, setResignedBy] = useState<"white" | "black" | null>(null);
  const [timedOutBy, setTimedOutBy] = useState<"white" | "black" | null>(null);
  const [agreedDraw, setAgreedDraw] = useState(false);
  const [drawOfferedBy, setDrawOfferedBy] = useState<"white" | "black" | null>(null);
  const [clockMs, setClockMs] = useState(() => initialClockState(timeControl));
  const [postGameAnalysis, setPostGameAnalysis] = useState<GameAnalysis | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [analysisError, setAnalysisError] = useState("");
  const [isOpeningReview, setIsOpeningReview] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [controlMessage, setControlMessage] = useState("");
  const [finalSaved, setFinalSaved] = useState(false);
  const [viewedPly, setViewedPly] = useState<number | null>(null);
  const analysisSavedRef = useRef(false);
  const savedRatingRef = useRef<Pick<SavedGame, "rated" | "ratingType" | "ratingBefore" | "ratingAfter" | "ratingChange"> | null>(null);
  const lastTickRef = useRef(0);

  const settings = getSettings();
  const colors = boardColors(settings);
  const chess = useMemo(() => replay(moves, initialFen), [initialFen, moves]);
  const effectiveViewedPly = viewedPly ?? moves.length;
  const displayChess = useMemo(
    () => replay(moves.slice(0, effectiveViewedPly), initialFen),
    [effectiveViewedPly, initialFen, moves],
  );
  const heuristicAnalysis = useMemo(() => analyzeMoves(moves), [moves]);
  const modeLabel =
    mode === "bot" ? "Игра с ботом" : mode === "friend" ? "Партия с другом" : "Локальная партия";
  const botProfile = useMemo(() => getBotProfile(difficulty), [difficulty]);

  const result: { result: SavedGame["result"]; winner: SavedGame["winner"]; label: string } = agreedDraw
    ? {
        result: "1/2-1/2",
        winner: "draw",
        label: "Ничья по соглашению.",
      }
    : timedOutBy
      ? {
        result: timedOutBy === "white" ? "0-1" : "1-0",
        winner: timedOutBy === "white" ? ("black" as const) : ("white" as const),
        label: `Время вышло: ${timedOutBy === "white" ? "белые" : "черные"}.`,
      }
    : resignedBy
      ? {
          result: resignedBy === "white" ? "0-1" : "1-0",
          winner: resignedBy === "white" ? ("black" as const) : ("white" as const),
          label: `${resignedBy === "white" ? "Белые" : "Черные"} сдались.`,
        }
      : getGameResult(chess);
  const isGameOver = result.result !== "*";
  const isViewingHistory = effectiveViewedPly !== moves.length;
  const lastMove = displayChess.history({ verbose: true }).at(-1);
  const botColor = playerColor === "white" ? "b" : "w";
  const isBotTurn = mode === "bot" && chess.turn() === botColor && !isGameOver;
  const activeAnalysis = postGameAnalysis ?? heuristicAnalysis;
  const timeControlActive = timeControl.initialSeconds !== null;
  const topSide = orientation === "white" ? "black" : "white";
  const bottomSide = orientation === "white" ? "white" : "black";
  const currentTurn = chess.turn();

  useEffect(() => {
    lastTickRef.current = Date.now();
  }, [currentTurn, isGameOver, pendingPromotion]);

  useEffect(() => {
    if (!timeControlActive || isGameOver || pendingPromotion) return;

    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastTickRef.current;
      lastTickRef.current = now;
      setClockMs((current) => {
        if (!current) return current;
        const side = chess.turn() === "w" ? "white" : "black";
        const nextValue = Math.max(0, current[side] - elapsed);
        if (nextValue <= 0) {
          setTimedOutBy((existing) => existing ?? side);
        }
        return {
          ...current,
          [side]: nextValue,
        };
      });
    }, 100);

    return () => window.clearInterval(timer);
  }, [chess, isGameOver, pendingPromotion, timeControlActive]);

  useEffect(() => {
    if (!isBotTurn) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      async function playBotMove() {
        let botMove = null;

        if (botProfile.useStockfish) {
          const result = await getStockfishBestMove(chess.fen(), {
            depth: botProfile.stockfishDepth,
            moveTime: botProfile.stockfishMoveTime,
            elo: botProfile.id === "stockfish" ? undefined : botProfile.elo,
            timeout: Math.max((botProfile.stockfishMoveTime ?? 1200) + 5000, 9000),
          });
          botMove = result?.bestMove ? findMoveFromUci(chess, result.bestMove) ?? null : null;
        }

        botMove ??= chooseBotMove(chess.fen(), difficulty);
        if (!botMove || cancelled) return;

        setMoves((current) => [...current, botMove.san]);
        if (timeControlActive) {
          setClockMs((current) =>
            current
              ? {
                  ...current,
                  [botMove.color === "w" ? "white" : "black"]:
                    current[botMove.color === "w" ? "white" : "black"] +
                    timeControl.incrementSeconds * 1000,
                }
              : current,
          );
        }
        playTone(botMove.isCapture() ? "capture" : "move");
      }

      void playBotMove();
    }, 550);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [botProfile, chess, difficulty, isBotTurn, timeControl.incrementSeconds, timeControlActive]);

  useEffect(() => {
    if (mode !== "bot" || !drawOfferedBy || isGameOver) return;

    const timer = window.setTimeout(() => {
      setDrawOfferedBy(null);
      setControlMessage(`${botProfile.name} отклонил ничью.`);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [botProfile.name, drawOfferedBy, isGameOver, mode]);

  useEffect(() => {
    if (isGameOver) playTone("end");
  }, [isGameOver]);

  useEffect(() => {
    if (!isGameOver || finalSaved) return;
    void persistGame({ markFinal: true, silent: true });
    // Auto-save intentionally uses the current game snapshot at the moment the game ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalSaved, isGameOver]);

  useEffect(() => {
    if (!isGameOver || !savedId || !postGameAnalysis || analysisSavedRef.current) return;
    analysisSavedRef.current = true;
    void persistGame({ markFinal: false, silent: true });
    // This only refreshes the saved analysis payload once Stockfish finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGameOver, postGameAnalysis, savedId]);

  useEffect(() => {
    if (!isGameOver || moves.length < 2 || analysisProgress || postGameAnalysis) return;

    let cancelled = false;
    const startTimer = window.setTimeout(() => {
      if (cancelled) return;
      setAnalysisError("");
      setAnalysisProgress({ done: 0, total: moves.length });

      void runStockfishGameAnalysis(moves, {
        beforeDepth: 10,
        afterDepth: 9,
        beforeMoveTime: 320,
        afterMoveTime: 220,
        timeout: 9000,
        onProgress: (done, total) => {
          if (!cancelled) setAnalysisProgress({ done, total });
        },
      })
        .then((analysis) => {
          if (cancelled) return;
          setPostGameAnalysis(analysis);
        })
        .catch(() => {
          if (cancelled) return;
          setAnalysisError("Глубокий анализ не завершился в этом браузере. Показана быстрая версия.");
        })
        .finally(() => {
          if (!cancelled) setAnalysisProgress(null);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
    };
  }, [analysisProgress, isGameOver, moves, postGameAnalysis]);

  const targets = isViewingHistory
    ? []
    : selectedSquare
      ? squareTargets(chess.fen(), selectedSquare)
      : hoverSquare
        ? squareTargets(chess.fen(), hoverSquare)
        : [];
  const squareStyles = Object.fromEntries([
    ...(settings.lastMoveHighlight && lastMove
      ? [
          [lastMove.from, { background: "rgba(240, 184, 77, 0.55)" }],
          [lastMove.to, { background: "rgba(240, 184, 77, 0.55)" }],
        ]
      : []),
    ...(selectedSquare ? [[selectedSquare, { background: "rgba(96, 197, 141, 0.55)" }]] : []),
    ...(settings.legalMoves ? targets : []).map((target) => [
      target,
      {
        background: "radial-gradient(circle, rgba(31, 122, 77, 0.46) 24%, transparent 27%)",
      },
    ]),
  ]);

  function canDragPiece({ piece }: { piece: { pieceType: string } }) {
    if (isViewingHistory || isGameOver || isBotTurn || pendingPromotion) return false;
    const currentPiecePrefix = chess.turn() === "w" ? "w" : "b";
    if (!piece.pieceType.startsWith(currentPiecePrefix)) return false;
    if (mode !== "bot") return true;
    return playerColor === "white"
      ? piece.pieceType.startsWith("w")
      : piece.pieceType.startsWith("b");
  }

  function applyIncrement(side: "white" | "black") {
    if (!timeControlActive) return;
    setClockMs((current) =>
      current
        ? {
            ...current,
            [side]: current[side] + timeControl.incrementSeconds * 1000,
          }
        : current,
    );
  }

  function needsPromotion(sourceSquare: string, targetSquare: string) {
    const piece = chess.get(sourceSquare as Square);
    if (!piece || piece.type !== "p") return false;
    return (
      (piece.color === "w" && targetSquare.endsWith("8")) ||
      (piece.color === "b" && targetSquare.endsWith("1"))
    );
  }

  function commitMove({
    sourceSquare,
    targetSquare,
    promotion = "q",
  }: {
    sourceSquare: string;
    targetSquare: string;
    promotion?: "q" | "r" | "b" | "n";
  }) {
    const next = replay(moves, initialFen);
    const movingSide = next.turn();

    try {
      const move = next.move({
        from: sourceSquare,
        to: targetSquare,
        promotion,
      });
      setMoves((current) => [...current, move.san]);
      applyIncrement(movingSide === "w" ? "white" : "black");
      setSelectedSquare(null);
      setPendingPromotion(null);
      playTone(move.isCapture() ? "capture" : "move");
      return true;
    } catch {
      return false;
    }
  }

  function onDrop({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }) {
    if (!targetSquare || isGameOver || isBotTurn || pendingPromotion) return false;
    if (isViewingHistory) return false;

    if (needsPromotion(sourceSquare, targetSquare)) {
      if (settings.autoQueen) return commitMove({ sourceSquare, targetSquare, promotion: "q" });
      setPendingPromotion({
        from: sourceSquare,
        to: targetSquare,
        side: chess.turn() === "w" ? "white" : "black",
      });
      return false;
    }

    return commitMove({ sourceSquare, targetSquare });
  }

  function onSquareClick({ square }: { square: string }) {
    if (isViewingHistory) return;
    if (isGameOver || isBotTurn || pendingPromotion) return;
    const piece = chess.get(square as Square);

    if (selectedSquare && targets.includes(square as Square)) {
      onDrop({ sourceSquare: selectedSquare, targetSquare: square });
      return;
    }

    if (!piece) {
      setSelectedSquare(null);
      return;
    }

    const isPlayerPiece =
      mode !== "bot" ||
      (playerColor === "white" ? piece.color === "w" : piece.color === "b");

    if (piece.color === chess.turn() && isPlayerPiece) {
      setSelectedSquare(square);
    }
  }

  function newGame() {
    setMoves([]);
    setSavedId(null);
    setResignedBy(null);
    setTimedOutBy(null);
    setAgreedDraw(false);
    setDrawOfferedBy(null);
    setClockMs(initialClockState(timeControl));
    setPostGameAnalysis(null);
    setAnalysisProgress(null);
    setAnalysisError("");
    setPendingPromotion(null);
    setControlMessage("");
    setFinalSaved(false);
    setViewedPly(null);
    analysisSavedRef.current = false;
    savedRatingRef.current = null;
  }

  function rematch() {
    newGame();
  }

  function resign() {
    if (isGameOver) return;
    const side = chess.turn() === "w" ? "white" : "black";
    setResignedBy(side);
    setDrawOfferedBy(null);
    setControlMessage(`${side === "white" ? "Белые" : "Черные"} сдались.`);
  }

  function offerDraw() {
    if (isGameOver || drawOfferedBy || isBotTurn) return;
    const side = chess.turn() === "w" ? "white" : "black";
    setDrawOfferedBy(side);
    setControlMessage(`${side === "white" ? "Белые" : "Черные"} предложили ничью.`);
  }

  function acceptDraw() {
    const side = chess.turn() === "w" ? "white" : "black";
    if (!drawOfferedBy || isGameOver || drawOfferedBy === side) return;
    setAgreedDraw(true);
    setDrawOfferedBy(null);
    setControlMessage("Ничья принята.");
  }

  function declineDraw() {
    const side = chess.turn() === "w" ? "white" : "black";
    if (!drawOfferedBy || isGameOver || drawOfferedBy === side) return;
    setControlMessage("Предложение ничьей отклонено.");
    setDrawOfferedBy(null);
  }

  function endReason() {
    if (timedOutBy) return `Timeout: ${timedOutBy === "white" ? "White" : "Black"} flagged`;
    if (resignedBy) return `Resignation: ${resignedBy === "white" ? "White" : "Black"} resigned`;
    if (agreedDraw) return "Draw agreement";
    if (chess.isCheckmate()) return "Checkmate";
    if (chess.isStalemate()) return "Stalemate";
    if (chess.isInsufficientMaterial()) return "Insufficient material";
    if (chess.isThreefoldRepetition()) return "Threefold repetition";
    if (chess.isDraw() && Number(chess.fen().split(" ")[4] ?? 0) >= 100) return "50-move rule";
    if (chess.isDraw()) return "Draw";
    return result.result === "*" ? "In progress" : result.label;
  }

  function playerNames() {
    if (mode === "bot") {
      return playerColor === "white"
        ? { whitePlayer: user?.username ?? "You", blackPlayer: botProfile.name }
        : { whitePlayer: botProfile.name, blackPlayer: user?.username ?? "You" };
    }

    if (mode === "friend") return { whitePlayer: "White", blackPlayer: "Black" };
    return { whitePlayer: "White", blackPlayer: "Black" };
  }

  async function persistGame({
    markFinal = result.result !== "*",
    silent = false,
  }: {
    markFinal?: boolean;
    silent?: boolean;
  } = {}) {
    const analysis = postGameAnalysis ?? heuristicAnalysis;
    const id = savedId ?? crypto.randomUUID();
    const shouldRecordProfile = markFinal && !finalSaved && user && result.result !== "*";
    const userWon = shouldRecordProfile ? result.winner === playerColor : false;
    const draw = result.winner === "draw";
    const ratingType = ratingTypeForTimeControl(timeControl) ?? undefined;
    const rated = Boolean(shouldRecordProfile && ratingType && isRatedGame(mode, timeControl));
    const ratingBefore = user && ratingType ? ratingForProfile(user, ratingType) : user?.rating;
    const opponentRating = mode === "bot" ? botProfile.elo : 1200;
    const score = draw ? 0.5 : userWon ? 1 : 0;
    const ratingChange =
      rated && typeof ratingBefore === "number"
        ? calculateRatingChange({
            playerRating: ratingBefore,
            opponentRating,
            score: score as 0 | 0.5 | 1,
          })
        : 0;
    const ratingAfter = typeof ratingBefore === "number" ? ratingBefore + ratingChange : undefined;
    const preservedRating = !shouldRecordProfile ? savedRatingRef.current : null;
    const savedRated = preservedRating?.rated ?? rated;
    const savedRatingType = preservedRating?.ratingType ?? ratingType;
    const savedRatingBefore = preservedRating?.ratingBefore ?? ratingBefore;
    const savedRatingAfter = preservedRating?.ratingAfter ?? ratingAfter;
    const savedRatingChange = preservedRating?.ratingChange ?? ratingChange;
    const names = playerNames();
    const game: SavedGame = {
      id,
      mode,
      whiteUserId: playerColor === "white" ? user?.id : undefined,
      blackUserId: playerColor === "black" ? user?.id : undefined,
      whitePlayer: names.whitePlayer,
      blackPlayer: names.blackPlayer,
      result: result.result,
      winner: result.winner,
      endReason: endReason(),
      opponent:
        mode === "bot"
          ? `${botProfile.name} ${botProfile.elo}`
          : mode === "friend"
            ? "Комната друга"
            : "Локальная партия",
      moves,
      pgn: chess.pgn(),
      finalPosition: chess.fen() || START_FEN,
      timeControl: timeControl.label,
      rated: savedRated,
      ratingType: savedRatingType,
      ratingBefore: savedRatingBefore,
      ratingAfter: savedRatingAfter,
      ratingChange: savedRatingChange,
      whiteAccuracy: analysis.whiteAccuracy,
      blackAccuracy: analysis.blackAccuracy,
      analysis,
      createdAt: new Date().toISOString(),
    };

    saveGame(game);
    try {
      await saveGameToSupabase(game);
    } catch {
      // Keep the local save if Supabase is unavailable or policies reject anonymous games.
    }
    setSavedId(id);
    if (markFinal) setFinalSaved(true);
    if (markFinal || savedRated) {
      savedRatingRef.current = {
        rated: savedRated,
        ratingType: savedRatingType,
        ratingBefore: savedRatingBefore,
        ratingAfter: savedRatingAfter,
        ratingChange: savedRatingChange,
      };
    }
    if (!silent) setControlMessage("Партия сохранена.");

    if (shouldRecordProfile) {
      await updateProfile({
        gamesCount: user.gamesCount + 1,
        wins: user.wins + (userWon ? 1 : 0),
        losses: user.losses + (!userWon && !draw ? 1 : 0),
        draws: user.draws + (draw ? 1 : 0),
        ...(rated && ratingType && typeof ratingAfter === "number"
          ? ratingPatch(user, ratingType, ratingAfter)
          : {}),
      });
    }

    return id;
  }

  async function openReview() {
    if (!moves.length) return;
    setIsOpeningReview(true);
    try {
      const id = await persistGame();
      router.push(`/analysis?id=${id}`);
    } finally {
      setIsOpeningReview(false);
    }
  }

  async function copyText(value: string, message: string) {
    await navigator.clipboard.writeText(value);
    setControlMessage(message);
  }

  function copyPgn() {
    void copyText(chess.pgn() || "*", "PGN скопирован.");
  }

  function copyFen() {
    void copyText(chess.fen(), "FEN скопирован.");
  }

  function sideDisplayName(side: "white" | "black") {
    if (mode === "bot") {
      const isPlayerSide = playerColor === side;
      return isPlayerSide ? "Вы" : botProfile.name;
    }

    if (mode === "friend") return side === "white" ? "Белые" : "Черные";
    return side === "white" ? "Белые" : "Черные";
  }

  function sideClock(side: "white" | "black") {
    if (!clockMs) return "Без лимита";
    return formatClock(clockMs[side]);
  }

  function clockPanelClass(side: "white" | "black") {
    const active = chess.turn() === (side === "white" ? "w" : "b") && !isGameOver;
    const lowTime = isLowClock(clockMs?.[side]) && !isGameOver;

    if (lowTime && active) {
      return "bg-destructive/25 text-destructive ring-2 ring-destructive/70 shadow-lg shadow-destructive/15";
    }

    if (active) return "bg-primary/20 ring-1 ring-primary/40";
    if (lowTime) return "bg-destructive/12 text-destructive ring-1 ring-destructive/30";
    return "bg-muted";
  }

  function jumpToPly(nextPly: number) {
    const clamped = Math.max(0, Math.min(moves.length, nextPly));
    setViewedPly(clamped === moves.length ? null : clamped);
    setSelectedSquare(null);
    setHoverSquare(null);
  }

  const reviewCounts = summarizeMoveTypes(activeAnalysis.evaluations);
  const isReviewPending = isGameOver && moves.length >= 2 && Boolean(analysisProgress) && !postGameAnalysis;
  const canOpenReview = isGameOver && moves.length > 0 && !isReviewPending;
  const activeSide = chess.turn() === "w" ? "white" : "black";
  const canOfferDraw = !isGameOver && !drawOfferedBy && !isBotTurn;
  const canRespondToDraw = Boolean(
    mode !== "bot" && drawOfferedBy && drawOfferedBy !== activeSide && !isGameOver,
  );
  const countMoveTypes = (...types: GameAnalysis["evaluations"][number]["type"][]) =>
    activeAnalysis.evaluations.filter((item) => types.includes(item.type)).length;
  const postGameTitle =
    result.winner === "draw"
      ? "Ничья"
      : mode === "bot"
        ? result.winner === playerColor
          ? "Вы выиграли"
          : "Вы проиграли"
        : result.winner === "white"
          ? "Победили белые"
          : "Победили черные";
  const postGameStats = [
    {
      label: "Ошибки",
      value: countMoveTypes("inaccuracy", "mistake", "blunder", "missed win"),
    },
    {
      label: "Хорошие",
      value: countMoveTypes("checkmate", "best move", "excellent", "good move"),
    },
    {
      label: "Бриллианты",
      value: countMoveTypes("brilliant"),
    },
  ];
  const postGameRatingText =
    savedRatingRef.current?.rated && typeof savedRatingRef.current.ratingChange === "number"
      ? `${savedRatingRef.current.ratingChange >= 0 ? "+" : ""}${savedRatingRef.current.ratingChange} rating`
      : "Casual game";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <Card className="overflow-hidden p-3 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
          <div>
            <Badge>{mode === "bot" ? `${botProfile.name} (${botProfile.elo})` : modeLabel}</Badge>
            <h1 className="mt-2 text-2xl font-black tracking-tight">{result.label}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{timeControl.label}</Badge>
            <Button variant="secondary" onClick={newGame}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Новая
            </Button>
            <Button
              variant="secondary"
              onClick={() => setOrientation((side) => (side === "white" ? "black" : "white"))}
            >
              <Shuffle className="mr-2 h-4 w-4" />
              Перевернуть
            </Button>
          </div>
        </div>

        <div className="mx-auto grid max-w-[min(82vh,720px)] gap-3">
          <div
            className={`flex items-center justify-between rounded-2xl px-4 py-3 ${clockPanelClass(topSide)}`}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{sideDisplayName(topSide)}</p>
              <p className="text-sm font-medium text-muted-foreground">
                {isLowClock(clockMs?.[topSide]) && !isGameOver
                  ? "Мало времени"
                  : topSide === "white"
                    ? "Белые"
                    : "Черные"}
              </p>
            </div>
            <p className="font-mono text-3xl font-black">{sideClock(topSide)}</p>
          </div>

          <div className="relative mx-auto w-full">
            <Chessboard
              options={{
                id: `knightly-${mode}`,
                position: displayChess.fen(),
                boardOrientation: orientation,
                onPieceDrop: onDrop,
                onSquareClick,
                canDragPiece,
                onMouseOverSquare: ({ square }) => setHoverSquare(square),
                onMouseOutSquare: () => setHoverSquare(null),
                squareStyles,
                showNotation: settings.boardCoordinates,
                showAnimations: settings.animationSpeed > 0,
                animationDurationInMs: animationDuration(settings),
                boardStyle: {
                  borderRadius: "1.5rem",
                  boxShadow: "0 24px 80px rgba(0,0,0,0.22)",
                  overflow: "hidden",
                },
                lightSquareStyle: { backgroundColor: colors.light },
                darkSquareStyle: { backgroundColor: colors.dark },
              }}
            />
            {pendingPromotion ? (
              <div className="absolute inset-0 z-20 grid place-items-end bg-black/35 p-3 backdrop-blur-[2px] sm:place-items-center sm:p-4">
                <div className="w-full max-w-md rounded-2xl border bg-card/96 p-4 text-card-foreground shadow-2xl sm:p-5">
                  <h2 className="text-2xl font-black">Выберите превращение</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Пешка дошла до {pendingPromotion.to}. Игра ждёт выбора фигуры.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ["q", "Queen"],
                      ["r", "Rook"],
                      ["b", "Bishop"],
                      ["n", "Knight"],
                    ].map(([piece, label]) => (
                      <Button
                        key={piece}
                        variant="secondary"
                        className="h-24 flex-col rounded-2xl px-2 sm:h-20"
                        onClick={() =>
                          commitMove({
                            sourceSquare: pendingPromotion.from,
                            targetSquare: pendingPromotion.to,
                            promotion: piece as "q" | "r" | "b" | "n",
                          })
                        }
                      >
                        <span className="text-4xl leading-none sm:text-3xl">
                          {pendingPromotion.side === "white"
                            ? { q: "♕", r: "♖", b: "♗", n: "♘" }[piece]
                            : { q: "♛", r: "♜", b: "♝", n: "♞" }[piece]}
                        </span>
                        <span className="mt-2 text-xs">{label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            {isGameOver && !isViewingHistory ? (
              <div className="absolute inset-0 grid place-items-center bg-black/25 p-4 backdrop-blur-[2px]">
                <div className="w-full max-w-md rounded-2xl border bg-card/95 p-5 text-card-foreground shadow-2xl">
                  <p className="text-sm font-semibold text-muted-foreground">{result.label}</p>
                  <h2 className="mt-1 text-3xl font-black tracking-tight">{postGameTitle}</h2>

                  {isReviewPending ? (
                    <div className="mt-4 rounded-xl bg-muted p-4">
                      <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                        <span>Stockfish разбирает партию</span>
                        <span>
                          {analysisProgress?.done}/{analysisProgress?.total}
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${((analysisProgress?.done ?? 0) / (analysisProgress?.total ?? 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        Подожди пару секунд: так разбор не сохранит сырой список, где все ходы выглядят хорошими.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {postGameStats.map((item) => (
                          <div key={item.label} className="rounded-xl bg-muted p-3 text-center">
                            <p className="text-xs font-semibold text-muted-foreground">{item.label}</p>
                            <p className="mt-1 font-mono text-2xl font-black">{item.value}</p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 rounded-xl bg-muted p-3 text-center text-sm font-semibold">
                        {postGameRatingText}
                      </p>
                    </>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={newGame}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Новая
                    </Button>
                    <Button onClick={openReview} disabled={!canOpenReview || isOpeningReview}>
                      <Search className="mr-2 h-4 w-4" />
                      {isReviewPending ? "Идёт анализ..." : isOpeningReview ? "Открываю..." : "Разбор"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-muted px-3 py-3">
            <Button
              className="h-9 px-3"
              variant="secondary"
              onClick={() => jumpToPly(0)}
              disabled={!moves.length || effectiveViewedPly === 0}
              aria-label="Go to first position"
              title="Go to first position"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              className="h-9 px-3"
              variant="secondary"
              onClick={() => jumpToPly(effectiveViewedPly - 1)}
              disabled={!moves.length || effectiveViewedPly === 0}
              aria-label="Previous move"
              title="Previous move"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-28 text-center font-mono text-sm font-black">
              {effectiveViewedPly}/{moves.length}
            </span>
            <Button
              className="h-9 px-3"
              variant="secondary"
              onClick={() => jumpToPly(effectiveViewedPly + 1)}
              disabled={!moves.length || effectiveViewedPly === moves.length}
              aria-label="Next move"
              title="Next move"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              className="h-9 px-3"
              variant="secondary"
              onClick={() => jumpToPly(moves.length)}
              disabled={!moves.length || effectiveViewedPly === moves.length}
              aria-label="Go to current position"
              title="Go to current position"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
            {isViewingHistory ? (
              <Badge className="bg-accent/20 text-accent-foreground">
                Viewing history. Go to {moves.length}/{moves.length} to move.
              </Badge>
            ) : (
              <Badge>Live position</Badge>
            )}
          </div>

          <div
            className={`flex items-center justify-between rounded-2xl px-4 py-3 ${clockPanelClass(bottomSide)}`}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{sideDisplayName(bottomSide)}</p>
              <p className="text-sm font-medium text-muted-foreground">
                {isLowClock(clockMs?.[bottomSide]) && !isGameOver
                  ? "Мало времени"
                  : bottomSide === "white"
                    ? "Белые"
                    : "Черные"}
              </p>
            </div>
            <p className="font-mono text-3xl font-black">{sideClock(bottomSide)}</p>
          </div>
        </div>
      </Card>

      <aside className="grid gap-4 content-start">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Статус</p>
              <p className="text-lg font-bold">
                {isBotTurn
                  ? botProfile.useStockfish
                    ? "Stockfish считает..."
                    : "Бот думает..."
                  : result.label}
              </p>
            </div>
            <Badge>Ход {chess.turn() === "w" ? "белых" : "черных"}</Badge>
          </div>
          <div className="mt-3 grid gap-2 rounded-2xl bg-muted p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Контроль времени</span>
              <span className="font-semibold">{timeControl.label}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Добавление</span>
              <span className="font-semibold">+{timeControl.incrementSeconds} сек</span>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={newGame}>
              <RotateCcw className="mr-2 h-4 w-4" />
              New Game
            </Button>
            <Button variant="secondary" onClick={rematch}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Rematch
            </Button>
            <Button variant="secondary" onClick={() => setOrientation((side) => (side === "white" ? "black" : "white"))}>
              <Shuffle className="mr-2 h-4 w-4" />
              Flip Board
            </Button>
            <Button variant="danger" onClick={resign} disabled={isGameOver}>
              <ShieldOff className="mr-2 h-4 w-4" />
              Resign
            </Button>
            <Button variant="secondary" onClick={offerDraw} disabled={!canOfferDraw}>
              <Handshake className="mr-2 h-4 w-4" />
              Offer Draw
            </Button>
            <Button variant="secondary" onClick={acceptDraw} disabled={!canRespondToDraw}>
              <Check className="mr-2 h-4 w-4" />
              Accept Draw
            </Button>
            <Button variant="secondary" onClick={declineDraw} disabled={!canRespondToDraw}>
              <X className="mr-2 h-4 w-4" />
              Decline Draw
            </Button>
            <Button variant="primary" onClick={() => void persistGame()}>
              <Save className="mr-2 h-4 w-4" />
              Save Game
            </Button>
            {isGameOver ? (
              <Button
                variant="secondary"
                onClick={openReview}
                disabled={!canOpenReview || isOpeningReview}
              >
                <Search className="mr-2 h-4 w-4" />
                {isReviewPending ? "Analyzing..." : isOpeningReview ? "Opening..." : "Analyze"}
              </Button>
            ) : null}
            <Button variant="secondary" onClick={copyPgn}>
              <Copy className="mr-2 h-4 w-4" />
              Copy PGN
            </Button>
            <Button variant="secondary" onClick={copyFen}>
              <Copy className="mr-2 h-4 w-4" />
              Copy FEN
            </Button>
          </div>
          {drawOfferedBy ? (
            <p className="mt-3 rounded-2xl bg-muted p-3 text-sm font-semibold">
              Draw offered by {drawOfferedBy === "white" ? "White" : "Black"}.
            </p>
          ) : null}
          {controlMessage ? (
            <p className="mt-3 rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
              {controlMessage}
            </p>
          ) : null}
          {savedId ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Сохранено {formatDate(new Date())}. Партию можно открыть из истории в любое время.
            </p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Сохраняется PGN, позиция и контроль времени.
            </p>
          )}
        </Card>

        {isGameOver ? (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black">Разбор партии</h2>
            {analysisProgress ? (
              <Badge>
                Stockfish {analysisProgress.done}/{analysisProgress.total}
              </Badge>
            ) : postGameAnalysis ? (
              <Badge>Глубокий разбор</Badge>
            ) : (
              <Badge>Быстрый разбор</Badge>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-muted p-4">
              <p className="text-sm text-muted-foreground">Точность белых</p>
              <p className="font-mono text-3xl font-black">{activeAnalysis.whiteAccuracy}%</p>
            </div>
            <div className="rounded-2xl bg-muted p-4">
              <p className="text-sm text-muted-foreground">Точность черных</p>
              <p className="font-mono text-3xl font-black">{activeAnalysis.blackAccuracy}%</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {reviewCounts.map((item) => (
              <div key={item.type} className="rounded-2xl bg-muted px-3 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {moveTypeLabel(item.type)}
                </p>
                <p className="mt-2 font-mono text-2xl font-black">{item.count}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-sm leading-6 text-muted-foreground">{activeAnalysis.summary}</p>
          <p className="mt-3 rounded-2xl bg-muted p-4 text-sm">{activeAnalysis.trainingFocus}</p>
          {activeAnalysis.bestMoment ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Лучший момент: {activeAnalysis.bestMoment.moveNumber}. {activeAnalysis.bestMoment.san} (
              {moveTypeLabel(activeAnalysis.bestMoment.type).toLowerCase()}).
            </p>
          ) : null}
          {activeAnalysis.worstMoment ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Критический момент: {activeAnalysis.worstMoment.moveNumber}. {activeAnalysis.worstMoment.san} (
              {moveTypeLabel(activeAnalysis.worstMoment.type).toLowerCase()}).
            </p>
          ) : null}
          {analysisError ? (
            <p className="mt-3 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
              {analysisError}
            </p>
          ) : null}
        </Card>
        ) : null}

        {isGameOver ? (
        <Card className="max-h-[34rem] overflow-auto">
          <h2 className="text-lg font-black">История ходов</h2>
          {moves.length ? (
            <div className="mt-4 grid gap-2 text-sm">
              {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, index) => {
                const whiteMove = moves[index * 2];
                const blackMove = moves[index * 2 + 1];
                const whiteEval = activeAnalysis.evaluations[index * 2];
                const blackEval = activeAnalysis.evaluations[index * 2 + 1];

                return (
                  <div key={index} className="grid grid-cols-[3rem_1fr_1fr] gap-2">
                    <span className="pt-2 font-mono text-muted-foreground">{index + 1}.</span>
                    <div className="rounded-xl bg-muted px-3 py-2 font-mono">
                      <div>{whiteMove}</div>
                      {whiteEval ? (
                        <div className="mt-1 text-[11px] font-semibold text-muted-foreground">
                          {moveTypeLabel(whiteEval.type)}
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-xl bg-muted px-3 py-2 font-mono">
                      <div>{blackMove ?? ""}</div>
                      {blackEval ? (
                        <div className="mt-1 text-[11px] font-semibold text-muted-foreground">
                          {moveTypeLabel(blackEval.type)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Перетащите фигуру, чтобы начать. Нелегальные ходы, рокировка, взятие на проходе,
              превращение пешки, мат и пат контролируются через chess.js.
            </p>
          )}
        </Card>
        ) : null}
      </aside>
    </div>
  );
}
