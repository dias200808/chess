"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { Chess } from "chess.js";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Cpu, Shuffle } from "lucide-react";
import type { GameAnalysis, MoveEvaluation, SavedGame } from "@/lib/types";
import { analyzeMoves, moveTypeLabel, summarizeMoveTypes } from "@/lib/chess-utils";
import { runStockfishGameAnalysis } from "@/lib/stockfish-client";
import { getSavedGamesSnapshot, logStudentActivity, saveGame } from "@/lib/storage";
import { fetchGameFromSupabase, saveGameToSupabase } from "@/lib/supabase-data";
import { cn } from "@/lib/utils";
import { Chessboard } from "@/components/client-chessboard";
import { Badge, Button, Card, LinkButton } from "@/components/ui";

function positionAt(moves: string[], ply: number) {
  const chess = new Chess();
  for (const move of moves.slice(0, ply)) {
    try {
      chess.move(move);
    } catch {
      break;
    }
  }
  return chess.fen();
}

function fallbackGame(): SavedGame {
  const moves = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "Ng5", "d5", "exd5", "Nxd5"];
  const analysis = analyzeMoves(moves);
  const chess = new Chess();
  moves.forEach((move) => chess.move(move));
  return {
    id: "sample",
    mode: "bot",
    result: "*",
    winner: null,
    opponent: "Sample bot",
    whitePlayer: "White",
    blackPlayer: "Sample bot",
    endReason: "Sample game",
    moves,
    pgn: chess.pgn(),
    finalPosition: chess.fen(),
    whiteAccuracy: analysis.whiteAccuracy,
    blackAccuracy: analysis.blackAccuracy,
    analysis,
    createdAt: new Date().toISOString(),
  };
}

function analysisForGame(game: SavedGame) {
  const saved = game.analysis;
  if (!saved?.evaluations?.length) return analyzeMoves(game.moves);
  const hasCurrentShape = saved.evaluations.every(
    (item, index) => item.ply === index + 1 && (item.color === "w" || item.color === "b"),
  );
  return hasCurrentShape ? saved : analyzeMoves(game.moves);
}

function formatEval(score: number) {
  if (Math.abs(score) >= 90000) {
    const mateDistance = Math.max(1, Math.round((100000 - Math.abs(score)) / 1000));
    return `${score > 0 ? "M" : "-M"}${mateDistance}`;
  }
  const pawns = score / 100;
  return `${pawns > 0 ? "+" : ""}${pawns.toFixed(1)}`;
}

function formatLoss(loss?: number) {
  if (typeof loss !== "number") return "0 cp";
  return `${Math.round(loss)} cp`;
}

function moveClassName(type: MoveEvaluation["type"]) {
  switch (type) {
    case "best move":
    case "brilliant":
    case "checkmate":
      return "border-emerald-500/45 bg-emerald-500/15 text-emerald-100";
    case "excellent":
      return "border-sky-500/45 bg-sky-500/15 text-sky-100";
    case "good move":
      return "border-border bg-muted text-foreground";
    case "inaccuracy":
      return "border-yellow-500/45 bg-yellow-500/15 text-yellow-100";
    case "mistake":
      return "border-orange-500/45 bg-orange-500/15 text-orange-100";
    case "blunder":
      return "border-red-500/50 bg-red-500/15 text-red-100";
    case "missed win":
      return "border-purple-500/45 bg-purple-500/15 text-purple-100";
    default:
      return "border-border bg-muted text-foreground";
  }
}

function moveBadgeClassName(type: MoveEvaluation["type"]) {
  switch (type) {
    case "best move":
    case "brilliant":
    case "checkmate":
      return "bg-emerald-500 text-white";
    case "excellent":
      return "bg-sky-500 text-white";
    case "good move":
      return "bg-zinc-700 text-white";
    case "inaccuracy":
      return "bg-yellow-400 text-black";
    case "mistake":
      return "bg-orange-500 text-white";
    case "blunder":
      return "bg-red-600 text-white";
    case "missed win":
      return "bg-purple-600 text-white";
    default:
      return "bg-zinc-700 text-white";
  }
}

function moveBadgeText(type: MoveEvaluation["type"]) {
  switch (type) {
    case "best move":
      return "!";
    case "brilliant":
      return "!!";
    case "excellent":
      return "OK";
    case "good move":
      return "+";
    case "inaccuracy":
      return "?!";
    case "mistake":
      return "?";
    case "blunder":
      return "??";
    case "missed win":
      return "!";
    case "checkmate":
      return "#";
    default:
      return "";
  }
}

function squareGridPosition(square?: string, orientation: "white" | "black" = "white") {
  if (!square || square.length < 2) return null;
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  if (orientation === "black") return { column: 8 - file, row: rank };
  return { column: file + 1, row: 9 - rank };
}

function BoardMoveBadge({
  move,
  orientation,
}: {
  move?: MoveEvaluation;
  orientation: "white" | "black";
}) {
  const target = squareGridPosition(move?.uci?.slice(2, 4), orientation);
  if (!move || !target) return null;

  return (
    <div className="pointer-events-none absolute inset-0 grid grid-cols-8 grid-rows-8">
      <div
        className="flex items-end justify-end p-[7%]"
        style={{ gridColumn: target.column, gridRow: target.row }}
      >
        <span
          className={cn(
            "grid h-8 min-w-8 place-items-center rounded-full border-2 border-white px-2 text-xs font-black shadow-xl sm:h-9 sm:min-w-9 sm:text-sm",
            moveBadgeClassName(move.type),
          )}
        >
          {moveBadgeText(move.type)}
        </span>
      </div>
    </div>
  );
}

function isBadMove(type: MoveEvaluation["type"]) {
  return ["inaccuracy", "mistake", "blunder", "missed win"].includes(type);
}

function preferredMoveHeading(move?: MoveEvaluation) {
  if (!move || !isBadMove(move.type)) return "Quality";
  if (move.type === "inaccuracy") return "Engine prefers";
  return "Best move";
}

function subscribeToNothing() {
  return () => {};
}

function parseSavedGamesSnapshot(snapshot: string) {
  try {
    const parsed = JSON.parse(snapshot) as SavedGame[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sideSummary(analysis: GameAnalysis, color: "w" | "b") {
  const moves = analysis.evaluations.filter((item) => item.color === color);
  const count = (...types: MoveEvaluation["type"][]) =>
    moves.filter((item) => types.includes(item.type)).length;
  return {
    best: count("best move", "brilliant", "checkmate"),
    good: count("excellent", "good move"),
    inaccuracies: count("inaccuracy"),
    mistakes: count("mistake", "missed win"),
    blunders: count("blunder"),
    accuracy: color === "w" ? analysis.whiteAccuracy : analysis.blackAccuracy,
  };
}

function EvaluationBar({
  score,
  orientation,
}: {
  score: number;
  orientation: "white" | "black";
}) {
  const whiteShare = Math.max(4, Math.min(96, 50 + Math.max(-800, Math.min(800, score)) / 16));

  return (
    <div className="grid h-full min-h-[18rem] w-10 overflow-hidden rounded-2xl border bg-black text-[10px] font-black shadow-inner sm:min-h-[28rem] sm:w-12 sm:text-xs">
      <div
        className="flex items-start justify-center px-1 py-2"
        style={{
          backgroundColor: orientation === "white" ? "#000" : "#fff",
          color: orientation === "white" ? "#fff" : "#000",
        }}
      >
        {orientation === "white"
          ? score < -80 ? formatEval(score) : ""
          : score > 80 ? formatEval(score) : ""}
      </div>
      <div className="relative bg-black">
        <div
          className={cn(
            "absolute left-0 right-0 bg-white transition-all",
            orientation === "white" ? "bottom-0" : "top-0",
          )}
          style={{ height: `${whiteShare}%` }}
        />
        <div className="absolute inset-0 grid place-items-center text-[10px] text-white mix-blend-difference sm:text-[11px]">
          {formatEval(score)}
        </div>
      </div>
      <div
        className="flex items-end justify-center px-1 py-2"
        style={{
          backgroundColor: orientation === "white" ? "#fff" : "#000",
          color: orientation === "white" ? "#000" : "#fff",
        }}
      >
        {orientation === "white"
          ? score > 80 ? formatEval(score) : ""
          : score < -80 ? formatEval(score) : ""}
      </div>
    </div>
  );
}

export function AnalysisClient() {
  const params = useSearchParams();
  const requestedId = params.get("id");
  const shouldAutoAnalyze = params.get("autostart") === "1" || Boolean(requestedId);
  const requestKey = requestedId ?? "__latest__";
  const serverGame = useMemo(() => fallbackGame(), []);
  const savedGamesSnapshot = useSyncExternalStore(
    subscribeToNothing,
    getSavedGamesSnapshot,
    () => "[]",
  );
  const localGame = useMemo(() => {
    const savedGames = parseSavedGamesSnapshot(savedGamesSnapshot);
    const savedGame = requestedId ? savedGames.find((game) => game.id === requestedId) : savedGames[0];
    return savedGame ?? serverGame;
  }, [requestedId, savedGamesSnapshot, serverGame]);
  const [remoteGame, setRemoteGame] = useState<{ key: string; game: SavedGame } | null>(null);

  useEffect(() => {
    if (!requestedId) return;
    let cancelled = false;

    void fetchGameFromSupabase(requestedId).then((nextGame) => {
      if (!cancelled && nextGame) {
        setRemoteGame({ key: requestKey, game: nextGame });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [requestKey, requestedId]);

  const resolvedRemoteGame = remoteGame?.key === requestKey ? remoteGame.game : null;
  const initialGame = resolvedRemoteGame ?? localGame;

  return (
    <AnalysisWorkspace
      key={`${requestKey}:${resolvedRemoteGame ? "remote" : "local"}:${initialGame.id}`}
      requestedId={requestedId}
      shouldAutoAnalyze={shouldAutoAnalyze}
      initialGame={initialGame}
    />
  );
}

function AnalysisWorkspace({
  requestedId,
  shouldAutoAnalyze,
  initialGame,
}: {
  requestedId: string | null;
  shouldAutoAnalyze: boolean;
  initialGame: SavedGame;
}) {
  const autoStartedRef = useRef(false);
  const [game, setGame] = useState(initialGame);
  const [ply, setPly] = useState(initialGame.moves.length);
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, initialGame.moves.length - 1));
  const [analysis, setAnalysis] = useState<GameAnalysis>(analysisForGame(initialGame));
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [engineProgress, setEngineProgress] = useState<{ done: number; total: number } | null>(null);
  const [engineError, setEngineError] = useState("");

  const runDeepAnalysis = useCallback(async () => {
    if (!game.moves.length || engineProgress) return;
    setEngineError("");
    setEngineProgress({ done: 0, total: game.moves.length });
    try {
      const stockfishAnalysis = await runStockfishGameAnalysis(game.moves, {
        beforeDepth: 13,
        afterDepth: 12,
        beforeMoveTime: 850,
        afterMoveTime: 550,
        timeout: 14000,
        onProgress: (done, total) => {
          setEngineProgress({ done, total });
        },
      });
      const updatedGame: SavedGame = {
        ...game,
        whiteAccuracy: stockfishAnalysis.whiteAccuracy,
        blackAccuracy: stockfishAnalysis.blackAccuracy,
        analysis: stockfishAnalysis,
      };
      setAnalysis(stockfishAnalysis);
      setGame(updatedGame);
      saveGame(updatedGame);
      await saveGameToSupabase(updatedGame).catch(() => null);
      [updatedGame.whiteUserId, updatedGame.blackUserId]
        .filter((value): value is string => Boolean(value))
        .forEach((userId) => {
          logStudentActivity({
            userId,
            type: "analyzed_game",
            title: "Game analyzed with Stockfish",
            relatedId: updatedGame.id,
            details: `${updatedGame.result} / ${updatedGame.timeControl ?? "no clock"}`,
          });
        });
    } catch {
      setEngineError("Stockfish could not finish the review in this browser. You can try again.");
    } finally {
      setEngineProgress(null);
    }
  }, [engineProgress, game]);

  useEffect(() => {
    if (!shouldAutoAnalyze || autoStartedRef.current || !game.moves.length) return;
    if (requestedId && game.id !== requestedId) return;
    const alreadyStockfish = analysis.evaluations.some((item) => item.engine === "stockfish");
    if (alreadyStockfish) return;
    autoStartedRef.current = true;
    const timer = window.setTimeout(() => {
      void runDeepAnalysis();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [analysis.evaluations, game.id, game.moves.length, requestedId, runDeepAnalysis, shouldAutoAnalyze]);

  const hasStockfishAnalysis = analysis.evaluations.some((item) => item.engine === "stockfish");
  const currentEval =
    ply <= 0
      ? analysis.evaluations[0]?.scoreBefore ?? 0
      : analysis.evaluations[Math.min(ply - 1, analysis.evaluations.length - 1)]?.scoreAfter ?? 0;
  const selectedMove = ply > 0 ? analysis.evaluations[selectedIndex] ?? analysis.evaluations.at(-1) : undefined;
  const reviewCounts = summarizeMoveTypes(analysis.evaluations);
  const evalPoints = analysis.evaluations.map((item, index) => ({
    x: analysis.evaluations.length <= 1 ? 0 : (index / (analysis.evaluations.length - 1)) * 100,
    y: 50 - Math.max(-900, Math.min(900, item.scoreAfter)) / 18,
  }));
  const evalPath = evalPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const keyMoments =
    hasStockfishAnalysis && analysis.keyMoments?.length
      ? analysis.keyMoments
      : hasStockfishAnalysis
        ? analysis.evaluations
            .filter((item) => isBadMove(item.type) || item.type === "checkmate")
            .slice(0, 8)
        : [];
  const whiteSummary = sideSummary(analysis, "w");
  const blackSummary = sideSummary(analysis, "b");
  const bestMoveUci =
    hasStockfishAnalysis &&
    selectedMove &&
    selectedMove.bestMoveUci &&
    selectedMove.bestMoveUci !== selectedMove.uci
      ? selectedMove.bestMoveUci
      : undefined;
  const bestMoveSquares =
    bestMoveUci && bestMoveUci.length >= 4
      ? [bestMoveUci.slice(0, 2), bestMoveUci.slice(2, 4)]
      : [];
  const bestMoveArrow =
    bestMoveSquares.length === 2
      ? {
          startSquare: bestMoveSquares[0],
          endSquare: bestMoveSquares[1],
          color: "rgba(34, 197, 94, 0.88)",
        }
      : undefined;
  const playedMoveSquares =
    selectedMove?.uci && selectedMove.uci.length >= 4
      ? [selectedMove.uci.slice(0, 2), selectedMove.uci.slice(2, 4)]
      : [];
  const squareStyles = {
    ...Object.fromEntries(
      playedMoveSquares.map((square) => [
        square,
        {
          background:
            "linear-gradient(135deg, rgba(240, 184, 77, 0.62), rgba(240, 184, 77, 0.28))",
        },
      ]),
    ),
    ...Object.fromEntries(
      bestMoveSquares.map((square) => [
        square,
        {
          background:
            "linear-gradient(135deg, rgba(34, 197, 94, 0.34), rgba(34, 197, 94, 0.12))",
          boxShadow: "inset 0 0 0 4px rgba(34, 197, 94, 0.8), 0 0 18px rgba(34, 197, 94, 0.35)",
        },
      ]),
    ),
  };

  const jumpToMove = useCallback((index: number) => {
    setSelectedIndex(index);
    setPly(index + 1);
  }, []);

  const jumpToPly = useCallback(
    (targetPly: number) => {
      const nextPly = Math.max(0, Math.min(game.moves.length, targetPly));
      setPly(nextPly);
      setSelectedIndex(Math.max(0, nextPly - 1));
    },
    [game.moves.length],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        jumpToPly(ply - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        jumpToPly(ply + 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        jumpToPly(0);
      } else if (event.key === "End") {
        event.preventDefault();
        jumpToPly(game.moves.length);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [game.moves.length, jumpToPly, ply]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Card className="order-1 p-3 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
          <div>
            <Badge>{game.mode} review</Badge>
            <h1 className="mt-2 text-3xl font-black">Game Review</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{game.result}</Badge>
            {engineProgress ? (
              <Badge>Analyzing {Math.round((engineProgress.done / engineProgress.total) * 100)}%</Badge>
            ) : hasStockfishAnalysis ? (
              <Badge>Stockfish</Badge>
            ) : (
              <Badge>Pending</Badge>
            )}
          </div>
        </div>

        {!hasStockfishAnalysis ? (
          <div className="mb-4 rounded-2xl border bg-muted p-4 text-sm leading-6 text-muted-foreground">
            {engineProgress
              ? "Stockfish is already reviewing the game. Accuracy, move grades, and best moves will appear automatically when it finishes."
              : "This page can run a full Stockfish review automatically. If it did not start, use Retry Stockfish below."}
          </div>
        ) : null}

        {engineProgress ? (
          <div className="mb-4 rounded-2xl border bg-muted p-4">
            <div className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span>Analyzing game...</span>
              <span>
                Move {engineProgress.done} of {engineProgress.total}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(engineProgress.done / engineProgress.total) * 100}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="mx-auto grid w-full max-w-[min(100%,92vh,860px)] grid-cols-[2.5rem_minmax(0,1fr)] gap-2 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-3">
          <EvaluationBar score={currentEval} orientation={orientation} />
          <div className="relative">
            <Chessboard
              options={{
                position: positionAt(game.moves, ply),
                boardOrientation: orientation,
                allowDragging: false,
                arrows: bestMoveArrow ? [bestMoveArrow] : [],
                squareStyles,
                boardStyle: {
                  borderRadius: "1.5rem",
                  boxShadow: "0 24px 80px rgba(0,0,0,0.22)",
                  overflow: "hidden",
                },
                lightSquareStyle: { backgroundColor: "#e8d4aa" },
                darkSquareStyle: { backgroundColor: "#58764a" },
              }}
            />
            <BoardMoveBadge move={hasStockfishAnalysis ? selectedMove : undefined} orientation={orientation} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <Button variant="secondary" aria-label="Go to start" title="Go to start" onClick={() => jumpToPly(0)}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            aria-label="Previous move"
            title="Previous move"
            onClick={() => jumpToPly(ply - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-24 text-center font-mono text-xs sm:min-w-32 sm:text-sm">
            {ply} / {game.moves.length} | {hasStockfishAnalysis ? formatEval(currentEval) : "not analyzed"}
          </span>
          <Button variant="secondary" aria-label="Next move" title="Next move" onClick={() => jumpToPly(ply + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="secondary" aria-label="Go to end" title="Go to end" onClick={() => jumpToPly(game.moves.length)}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
          <Button variant="secondary" onClick={() => setOrientation((side) => (side === "white" ? "black" : "white"))}>
            <Shuffle className="mr-2 h-4 w-4" />
            Flip Board
          </Button>
        </div>

        {selectedMove ? (
          <div className="mx-auto mt-4 grid max-w-[min(100%,92vh,860px)] gap-2 rounded-2xl border bg-muted p-4 text-sm sm:grid-cols-[1fr_1fr_1.3fr]">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Move</p>
              <p className="mt-1 font-mono text-lg font-black">
                {selectedMove.moveNumber}. {selectedMove.san}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Evaluation</p>
              <p className="mt-1 font-mono text-lg font-black">
                {hasStockfishAnalysis
                  ? `${formatEval(selectedMove.scoreBefore)} -> ${formatEval(selectedMove.scoreAfter)}`
                  : "not checked"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                {hasStockfishAnalysis && isBadMove(selectedMove.type) ? "Best move" : "Quality"}
              </p>
              <p className="mt-1 truncate font-semibold">
                {!hasStockfishAnalysis
                  ? "Waiting for Stockfish"
                  : isBadMove(selectedMove.type)
                    ? selectedMove.bestMove ?? "engine line"
                    : moveTypeLabel(selectedMove.type)}
              </p>
            </div>
          </div>
        ) : null}
      </Card>

      <aside className="order-2 grid content-start gap-4">
        <Card>
          <h2 className="text-xl font-black">AI Coach</h2>
          {hasStockfishAnalysis ? (
            <>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{analysis.summary}</p>
              <p className="mt-4 rounded-2xl bg-muted p-4 text-sm font-medium">{analysis.trainingFocus}</p>
            </>
          ) : (
            <p className="mt-3 rounded-2xl bg-muted p-4 text-sm leading-6 text-muted-foreground">
              Stockfish is responsible for the full review. This page will fill in move quality, best moves,
              and accuracy automatically as soon as the engine finishes.
            </p>
          )}
          {(!engineProgress || hasStockfishAnalysis || Boolean(engineError)) ? (
            <Button className="mt-4 w-full" variant="secondary" onClick={runDeepAnalysis} disabled={Boolean(engineProgress)}>
              <Cpu className="mr-2 h-4 w-4" />
              {engineProgress ? `Stockfish ${engineProgress.done}/${engineProgress.total}` : hasStockfishAnalysis ? "Re-run Stockfish" : "Retry Stockfish"}
            </Button>
          ) : null}
          {engineError ? (
            <p className="mt-3 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{engineError}</p>
          ) : null}
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <p className="text-sm text-muted-foreground">White accuracy</p>
            <p className="font-mono text-3xl font-black sm:text-4xl">
              {hasStockfishAnalysis ? `${analysis.whiteAccuracy}%` : "--"}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-muted-foreground">Black accuracy</p>
            <p className="font-mono text-3xl font-black sm:text-4xl">
              {hasStockfishAnalysis ? `${analysis.blackAccuracy}%` : "--"}
            </p>
          </Card>
        </div>

        {hasStockfishAnalysis && selectedMove ? (
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">Move {selectedMove.moveNumber}</h2>
              <Badge className={moveClassName(selectedMove.type)}>{moveTypeLabel(selectedMove.type)}</Badge>
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <div className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
                <span className="text-muted-foreground">You played</span>
                <span className="font-mono font-black">{selectedMove.san}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3">
                <span className="text-muted-foreground">{preferredMoveHeading(selectedMove)}</span>
                <span className="truncate font-mono font-black">{selectedMove.bestMove ?? "same idea"}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
                <span className="text-muted-foreground">Evaluation</span>
                <span className="font-mono font-black">
                  {formatEval(selectedMove.scoreBefore)} {"->"} {formatEval(selectedMove.scoreAfter)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
                <span className="text-muted-foreground">Centipawn loss</span>
                <span className="font-mono font-black">{formatLoss(selectedMove.centipawnLoss)}</span>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{selectedMove.note}</p>
          </Card>
        ) : null}

        <Card className="max-h-[28rem] overflow-auto sm:max-h-[32rem]">
          <h2 className="text-xl font-black">Move History</h2>
          <div className="mt-4 grid gap-2">
            {Array.from({ length: Math.ceil(game.moves.length / 2) }).map((_, turnIndex) => {
              const whiteMove = analysis.evaluations[turnIndex * 2];
              const blackMove = analysis.evaluations[turnIndex * 2 + 1];
              return (
                <div key={turnIndex} className="grid grid-cols-[2rem_1fr_1fr] gap-2 text-sm">
                  <span className="pt-3 font-mono text-muted-foreground">{turnIndex + 1}.</span>
                  {[whiteMove, blackMove].map((move, offset) =>
                    move ? (
                      <button
                        key={`${move.san}-${offset}`}
                        className={cn(
                          "rounded-2xl border px-3 py-2 text-left transition hover:-translate-y-0.5",
                          hasStockfishAnalysis ? moveClassName(move.type) : "border-border bg-muted text-foreground",
                          selectedIndex === move.ply - 1 && "ring-2 ring-primary",
                        )}
                        onClick={() => jumpToMove(move.ply - 1)}
                      >
                        <span className="font-mono font-black">{move.san}</span>
                        <span className="mt-1 block text-xs font-semibold opacity-80">
                          {hasStockfishAnalysis ? moveTypeLabel(move.type) : "not analyzed"}
                        </span>
                      </button>
                    ) : (
                      <span key={`empty-${offset}`} />
                    ),
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {hasStockfishAnalysis ? (
          <Card>
            <h2 className="text-xl font-black">Game Review Summary</h2>
            <div className="mt-4 grid gap-3 text-sm">
              {[
                ["White", whiteSummary],
                ["Black", blackSummary],
              ].map(([label, summary]) => {
                const item = summary as ReturnType<typeof sideSummary>;
                return (
                  <div key={label as string} className="rounded-2xl bg-muted p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black">{label as string}</h3>
                      <Badge>{item.accuracy}%</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-muted-foreground">
                      <span>Best: {item.best}</span>
                      <span>Good: {item.good}</span>
                      <span>Inaccuracies: {item.inaccuracies}</span>
                      <span>Mistakes: {item.mistakes}</span>
                      <span>Blunders: {item.blunders}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : null}

        <Card>
          <h2 className="text-xl font-black">Key Moments</h2>
          {keyMoments.length ? (
            <div className="mt-4 grid gap-2">
              {keyMoments.map((item) => (
                <button
                  key={`${item.ply}-${item.san}`}
                  className={cn(
                    "rounded-2xl border p-3 text-left text-sm transition hover:-translate-y-0.5",
                    moveClassName(item.type),
                  )}
                  onClick={() => jumpToMove(item.ply - 1)}
                >
                  <span className="font-mono font-black">
                    {item.moveNumber}. {item.san}
                  </span>
                  <Badge className="ml-2">{moveTypeLabel(item.type)}</Badge>
                  <span className="mt-1 block opacity-85">
                    Better was {item.bestMove ?? "the engine line"} | {formatEval(item.scoreBefore)} {"→"}{" "}
                    {formatEval(item.scoreAfter)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {hasStockfishAnalysis
                ? "No major mistakes found after the current analysis."
                : "Key moments will appear after Stockfish finishes the analysis."}
            </p>
          )}
        </Card>

        {hasStockfishAnalysis ? (
          <Card>
            <h2 className="text-xl font-black">Evaluation Graph</h2>
            <svg
              className="mt-4 h-32 w-full overflow-visible rounded-2xl bg-muted"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <line x1="0" x2="100" y1="50" y2="50" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1" />
              <path d={evalPath} fill="none" stroke="var(--primary)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
            </svg>
            <p className="mt-3 text-xs text-muted-foreground">
              Positive means White is better. Negative means Black is better.
            </p>
          </Card>
        ) : null}

        {hasStockfishAnalysis ? (
          <Card>
            <h2 className="text-xl font-black">Move Quality</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {reviewCounts.map((item) => (
                <div key={item.type} className={cn("rounded-2xl border p-4", moveClassName(item.type))}>
                  <p className="text-xs uppercase tracking-[0.14em] opacity-75">{moveTypeLabel(item.type)}</p>
                  <p className="mt-2 font-mono text-3xl font-black">{item.count}</p>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <LinkButton href="/history" variant="secondary">
          Back to history
        </LinkButton>
      </aside>
    </div>
  );
}
