"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { RotateCcw, Save, Search, ShieldOff, Shuffle } from "lucide-react";
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
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { Chessboard } from "@/components/client-chessboard";
import { Badge, Button, Card, LinkButton } from "@/components/ui";

function replay(moves: string[]) {
  const chess = new Chess();
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
    label: "Без лимита",
    initialSeconds: null,
    incrementSeconds: 0,
  },
}: {
  mode?: GameMode;
  playerColor?: "white" | "black";
  difficulty?: BotDifficulty;
  timeControl?: TimeControl;
}) {
  const { user, updateProfile } = useAuth();
  const [moves, setMoves] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<"white" | "black">(playerColor);
  const [hoverSquare, setHoverSquare] = useState<string | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [resignedBy, setResignedBy] = useState<"white" | "black" | null>(null);
  const [timedOutBy, setTimedOutBy] = useState<"white" | "black" | null>(null);
  const [clockMs, setClockMs] = useState(() => initialClockState(timeControl));
  const [postGameAnalysis, setPostGameAnalysis] = useState<GameAnalysis | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [analysisError, setAnalysisError] = useState("");
  const lastTickRef = useRef(0);

  const chess = useMemo(() => replay(moves), [moves]);
  const heuristicAnalysis = useMemo(() => analyzeMoves(moves), [moves]);
  const modeLabel =
    mode === "bot" ? "Игра с ботом" : mode === "friend" ? "Партия с другом" : "Локальная партия";
  const botProfile = useMemo(() => getBotProfile(difficulty), [difficulty]);

  const result: { result: SavedGame["result"]; winner: SavedGame["winner"]; label: string } = timedOutBy
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
  const lastMove = chess.history({ verbose: true }).at(-1);
  const botColor = playerColor === "white" ? "b" : "w";
  const isBotTurn = mode === "bot" && chess.turn() === botColor && !isGameOver;
  const activeAnalysis = postGameAnalysis ?? heuristicAnalysis;
  const timeControlActive = timeControl.initialSeconds !== null;
  const topSide = orientation === "white" ? "black" : "white";
  const bottomSide = orientation === "white" ? "white" : "black";
  const currentTurn = chess.turn();

  useEffect(() => {
    lastTickRef.current = Date.now();
  }, [currentTurn, isGameOver]);

  useEffect(() => {
    if (!timeControlActive || isGameOver) return;

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
  }, [chess, isGameOver, timeControlActive]);

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
    if (isGameOver) playTone("end");
  }, [isGameOver]);

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

  const targets = selectedSquare
    ? squareTargets(chess.fen(), selectedSquare)
    : hoverSquare
      ? squareTargets(chess.fen(), hoverSquare)
      : [];
  const squareStyles = Object.fromEntries([
    ...(lastMove
      ? [
          [lastMove.from, { background: "rgba(240, 184, 77, 0.55)" }],
          [lastMove.to, { background: "rgba(240, 184, 77, 0.55)" }],
        ]
      : []),
    ...(selectedSquare ? [[selectedSquare, { background: "rgba(96, 197, 141, 0.55)" }]] : []),
    ...targets.map((target) => [
      target,
      {
        background: "radial-gradient(circle, rgba(31, 122, 77, 0.46) 24%, transparent 27%)",
      },
    ]),
  ]);

  function canDragPiece({ piece }: { piece: { pieceType: string } }) {
    if (isGameOver || isBotTurn) return false;
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

  function onDrop({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }) {
    if (!targetSquare || isGameOver || isBotTurn) return false;
    const next = replay(moves);
    const movingSide = next.turn();

    try {
      const move = next.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });
      setMoves((current) => [...current, move.san]);
      applyIncrement(movingSide === "w" ? "white" : "black");
      setSelectedSquare(null);
      playTone(move.isCapture() ? "capture" : "move");
      return true;
    } catch {
      return false;
    }
  }

  function onSquareClick({ square }: { square: string }) {
    if (isGameOver || isBotTurn) return;
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
    setClockMs(initialClockState(timeControl));
    setPostGameAnalysis(null);
    setAnalysisProgress(null);
    setAnalysisError("");
  }

  function resign() {
    if (isGameOver) return;
    const side = chess.turn() === "w" ? "white" : "black";
    setResignedBy(side);
  }

  async function persistGame() {
    const analysis = postGameAnalysis ?? heuristicAnalysis;
    const id = savedId ?? crypto.randomUUID();
    const game: SavedGame = {
      id,
      mode,
      whiteUserId: playerColor === "white" ? user?.id : undefined,
      blackUserId: playerColor === "black" ? user?.id : undefined,
      result: result.result,
      winner: result.winner,
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

    if (user && result.result !== "*") {
      const userSide = playerColor;
      const userWon = result.winner === userSide;
      const draw = result.winner === "draw";
      await updateProfile({
        gamesCount: user.gamesCount + 1,
        wins: user.wins + (userWon ? 1 : 0),
        losses: user.losses + (!userWon && !draw ? 1 : 0),
        draws: user.draws + (draw ? 1 : 0),
        rating: user.rating + (draw ? 0 : userWon ? 10 : -10),
      });
    }
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

  const reviewCounts = summarizeMoveTypes(activeAnalysis.evaluations);

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
            className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
              chess.turn() === (topSide === "white" ? "w" : "b") && !isGameOver
                ? "bg-primary/20 ring-1 ring-primary/40"
                : "bg-muted"
            }`}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{sideDisplayName(topSide)}</p>
              <p className="text-sm font-medium text-muted-foreground">
                {topSide === "white" ? "Белые" : "Черные"}
              </p>
            </div>
            <p className="font-mono text-3xl font-black">{sideClock(topSide)}</p>
          </div>

          <div className="mx-auto w-full">
            <Chessboard
              options={{
                id: `knightly-${mode}`,
                position: chess.fen(),
                boardOrientation: orientation,
                onPieceDrop: onDrop,
                onSquareClick,
                canDragPiece,
                onMouseOverSquare: ({ square }) => setHoverSquare(square),
                onMouseOutSquare: () => setHoverSquare(null),
                squareStyles,
                showAnimations: true,
                animationDurationInMs: 180,
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

          <div
            className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
              chess.turn() === (bottomSide === "white" ? "w" : "b") && !isGameOver
                ? "bg-primary/20 ring-1 ring-primary/40"
                : "bg-muted"
            }`}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{sideDisplayName(bottomSide)}</p>
              <p className="text-sm font-medium text-muted-foreground">
                {bottomSide === "white" ? "Белые" : "Черные"}
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
            <Button variant="danger" onClick={resign} disabled={isGameOver}>
              <ShieldOff className="mr-2 h-4 w-4" />
              Сдаться
            </Button>
            <Button variant="primary" onClick={persistGame}>
              <Save className="mr-2 h-4 w-4" />
              Сохранить
            </Button>
          </div>
          <LinkButton
            href={savedId ? `/analysis?id=${savedId}` : "/analysis"}
            variant="secondary"
            className="mt-3 w-full"
          >
            <Search className="mr-2 h-4 w-4" />
            Полный анализ
          </LinkButton>
          {savedId ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Сохранено {formatDate(new Date())}. Партию можно открыть из истории в любое время.
            </p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Сохраняется PGN, позиция, контроль времени и разбор партии.
            </p>
          )}
        </Card>

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
      </aside>
    </div>
  );
}
