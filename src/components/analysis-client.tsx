"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Chess } from "chess.js";
import { ChevronLeft, ChevronRight, Cpu } from "lucide-react";
import type { GameAnalysis, MoveEvaluation, SavedGame } from "@/lib/types";
import { analyzeMoves, moveTypeLabel, summarizeMoveTypes } from "@/lib/chess-utils";
import { runStockfishGameAnalysis } from "@/lib/stockfish-client";
import { getSavedGame, getSavedGames, saveGame } from "@/lib/storage";
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

function isBadMove(type: MoveEvaluation["type"]) {
  return ["inaccuracy", "mistake", "blunder", "missed win"].includes(type);
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

function EvaluationBar({ score }: { score: number }) {
  const whiteShare = Math.max(4, Math.min(96, 50 + Math.max(-800, Math.min(800, score)) / 16));

  return (
    <div className="grid h-full min-h-[28rem] w-12 overflow-hidden rounded-2xl border bg-black text-xs font-black shadow-inner">
      <div className="flex items-start justify-center bg-black px-1 py-2 text-white">
        {score < -80 ? formatEval(score) : ""}
      </div>
      <div className="relative bg-black">
        <div
          className="absolute bottom-0 left-0 right-0 bg-white transition-all"
          style={{ height: `${whiteShare}%` }}
        />
        <div className="absolute inset-0 grid place-items-center text-[11px] text-white mix-blend-difference">
          {formatEval(score)}
        </div>
      </div>
      <div className="flex items-end justify-center bg-white px-1 py-2 text-black">
        {score > 80 ? formatEval(score) : ""}
      </div>
    </div>
  );
}

export function AnalysisClient() {
  const params = useSearchParams();
  const requestedId = params.get("id");
  const autoStartedRef = useRef(false);
  const initialGame = useMemo(() => {
    if (requestedId) return getSavedGame(requestedId) ?? fallbackGame();
    return getSavedGames()[0] ?? fallbackGame();
  }, [requestedId]);
  const [game, setGame] = useState(initialGame);
  const [ply, setPly] = useState(initialGame.moves.length);
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, initialGame.moves.length - 1));
  const [analysis, setAnalysis] = useState<GameAnalysis>(
    analysisForGame(initialGame),
  );
  const [engineProgress, setEngineProgress] = useState<{ done: number; total: number } | null>(null);
  const [engineError, setEngineError] = useState("");

  useEffect(() => {
    if (!requestedId) return;
    void fetchGameFromSupabase(requestedId).then((remoteGame) => {
      if (!remoteGame) return;
      setGame(remoteGame);
      setPly(remoteGame.moves.length);
      setSelectedIndex(Math.max(0, remoteGame.moves.length - 1));
      setAnalysis(analysisForGame(remoteGame));
    });
  }, [requestedId]);

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
    } catch {
      setEngineError("Stockfish не смог завершить разбор в этом браузере. Показана быстрая версия.");
    } finally {
      setEngineProgress(null);
    }
  }, [engineProgress, game]);

  useEffect(() => {
    if (!requestedId || autoStartedRef.current || game.id !== requestedId || !game.moves.length) return;
    const alreadyStockfish = analysis.evaluations.some((item) => item.engine === "stockfish");
    if (alreadyStockfish) return;
    autoStartedRef.current = true;
    const timer = window.setTimeout(() => {
      void runDeepAnalysis();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [analysis.evaluations, game.id, game.moves.length, requestedId, runDeepAnalysis]);

  const currentEval =
    ply <= 0
      ? analysis.evaluations[0]?.scoreBefore ?? 0
      : analysis.evaluations[Math.min(ply - 1, analysis.evaluations.length - 1)]?.scoreAfter ?? 0;
  const selectedMove = analysis.evaluations[selectedIndex] ?? analysis.evaluations.at(-1);
  const reviewCounts = summarizeMoveTypes(analysis.evaluations);
  const evalPoints = analysis.evaluations.map((item, index) => ({
    x: analysis.evaluations.length <= 1 ? 0 : (index / (analysis.evaluations.length - 1)) * 100,
    y: 50 - Math.max(-900, Math.min(900, item.scoreAfter)) / 18,
  }));
  const evalPath = evalPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const keyMoments =
    analysis.keyMoments?.length
      ? analysis.keyMoments
      : analysis.evaluations
          .filter((item) => isBadMove(item.type) || item.type === "checkmate")
          .slice(0, 8);
  const whiteSummary = sideSummary(analysis, "w");
  const blackSummary = sideSummary(analysis, "b");
  const bestMoveUci =
    selectedMove && isBadMove(selectedMove.type) ? selectedMove.bestMoveUci : undefined;
  const bestMoveSquares =
    bestMoveUci && bestMoveUci.length >= 4
      ? [bestMoveUci.slice(0, 2), bestMoveUci.slice(2, 4)]
      : [];
  const squareStyles = Object.fromEntries(
    bestMoveSquares.map((square) => [
      square,
      {
        background:
          "radial-gradient(circle, rgba(96, 197, 141, 0.6) 34%, rgba(96, 197, 141, 0.22) 36%, transparent 42%)",
      },
    ]),
  );

  function jumpToMove(index: number) {
    setSelectedIndex(index);
    setPly(index + 1);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_28rem]">
      <Card className="p-3 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
          <div>
            <Badge>{game.mode} review</Badge>
            <h1 className="mt-2 text-3xl font-black">Game Review</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{game.result}</Badge>
            {engineProgress ? (
              <Badge>Analyzing {Math.round((engineProgress.done / engineProgress.total) * 100)}%</Badge>
            ) : analysis.evaluations.some((item) => item.engine === "stockfish") ? (
              <Badge>Stockfish</Badge>
            ) : (
              <Badge>Fast review</Badge>
            )}
          </div>
        </div>

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

        <div className="mx-auto grid max-w-[min(92vh,860px)] grid-cols-[3rem_minmax(0,1fr)] gap-3">
          <EvaluationBar score={currentEval} />
          <Chessboard
            options={{
              position: positionAt(game.moves, ply),
              allowDragging: false,
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
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              const nextPly = Math.max(0, ply - 1);
              setPly(nextPly);
              setSelectedIndex(Math.max(0, nextPly - 1));
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-mono text-sm">
            {ply} / {game.moves.length} · {formatEval(currentEval)}
          </span>
          <Button
            variant="secondary"
            onClick={() => {
              const nextPly = Math.min(game.moves.length, ply + 1);
              setPly(nextPly);
              setSelectedIndex(Math.max(0, nextPly - 1));
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <aside className="grid gap-4 content-start">
        <Card>
          <h2 className="text-xl font-black">AI Coach</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{analysis.summary}</p>
          <p className="mt-4 rounded-2xl bg-muted p-4 text-sm font-medium">{analysis.trainingFocus}</p>
          <Button
            className="mt-4 w-full"
            variant="secondary"
            onClick={runDeepAnalysis}
            disabled={Boolean(engineProgress)}
          >
            <Cpu className="mr-2 h-4 w-4" />
            {engineProgress
              ? `Stockfish ${engineProgress.done}/${engineProgress.total}`
              : "Analyze with Stockfish"}
          </Button>
          {engineError ? (
            <p className="mt-3 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
              {engineError}
            </p>
          ) : null}
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <p className="text-sm text-muted-foreground">White accuracy</p>
            <p className="font-mono text-4xl font-black">{analysis.whiteAccuracy}%</p>
          </Card>
          <Card>
            <p className="text-sm text-muted-foreground">Black accuracy</p>
            <p className="font-mono text-4xl font-black">{analysis.blackAccuracy}%</p>
          </Card>
        </div>

        {selectedMove ? (
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
              <div className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
                <span className="text-muted-foreground">Best was</span>
                <span className="font-mono font-black">{selectedMove.bestMove ?? "same idea"}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
                <span className="text-muted-foreground">Evaluation</span>
                <span className="font-mono font-black">
                  {formatEval(selectedMove.scoreBefore)} → {formatEval(selectedMove.scoreAfter)}
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

        <Card className="max-h-[32rem] overflow-auto">
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
                          moveClassName(move.type),
                          selectedIndex === move.ply - 1 && "ring-2 ring-primary",
                        )}
                        onClick={() => jumpToMove(move.ply - 1)}
                      >
                        <span className="font-mono font-black">{move.san}</span>
                        <span className="mt-1 block text-xs font-semibold opacity-80">
                          {moveTypeLabel(move.type)}
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
                    Better was {item.bestMove ?? "the engine line"} · {formatEval(item.scoreBefore)} →{" "}
                    {formatEval(item.scoreAfter)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No major mistakes found after the current analysis.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="text-xl font-black">Evaluation Graph</h2>
          <svg className="mt-4 h-32 w-full overflow-visible rounded-2xl bg-muted" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="0" x2="100" y1="50" y2="50" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1" />
            <path d={evalPath} fill="none" stroke="var(--primary)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          </svg>
          <p className="mt-3 text-xs text-muted-foreground">
            Positive means White is better. Negative means Black is better.
          </p>
        </Card>

        <Card>
          <h2 className="text-xl font-black">Move Quality</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {reviewCounts.map((item) => (
              <div key={item.type} className={cn("rounded-2xl border p-4", moveClassName(item.type))}>
                <p className="text-xs uppercase tracking-[0.14em] opacity-75">
                  {moveTypeLabel(item.type)}
                </p>
                <p className="mt-2 font-mono text-3xl font-black">{item.count}</p>
              </div>
            ))}
          </div>
        </Card>

        <LinkButton href="/history" variant="secondary">Back to history</LinkButton>
      </aside>
    </div>
  );
}
