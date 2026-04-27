"use client";

import { useEffect, useMemo, useState } from "react";
import { Chess, type Move, type Square } from "chess.js";
import { Chessboard } from "@/components/client-chessboard";
import { Flame, Heart, Lightbulb, Timer, Trophy, Zap } from "lucide-react";
import { Badge, Button, Card, SelectField } from "@/components/ui";
import { puzzles } from "@/lib/data";
import { getPuzzleState, getSettings, setPuzzleState } from "@/lib/storage";
import {
  fetchPuzzleProgressFromSupabase,
  upsertPuzzleProgressToSupabase,
} from "@/lib/supabase-data";
import type { Puzzle, PuzzleProgress } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";

type PuzzleMode = "practice" | "rush" | "survival";

const RUSH_SECONDS = 180;
const SPECIAL_RUSH_KEY = "__rush__";
const SPECIAL_META_KEY = "__meta__";
const STARTING_PUZZLE_RATING = 800;

function defaultProgress(): PuzzleProgress {
  return {
    solved: false,
    attempts: 0,
    score: 0,
    bestRushScore: 0,
    currentStreak: 0,
    bestStreak: 0,
    puzzleRating: STARTING_PUZZLE_RATING,
    bestPuzzleRating: STARTING_PUZZLE_RATING,
  };
}

function normalizeProgress(progress?: Partial<PuzzleProgress>): PuzzleProgress {
  return { ...defaultProgress(), ...progress };
}

function moveCode(move: Move) {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function isPuzzleMove(move: Move, puzzle: Puzzle) {
  const code = moveCode(move);
  return code === puzzle.bestMove || `${move.from}${move.to}` === puzzle.bestMove;
}

function expectedMoveFor(puzzle: Puzzle, linePly: number) {
  return puzzle.line?.[linePly] ?? puzzle.bestMove;
}

function isExpectedMove(move: Move, puzzle: Puzzle, linePly: number) {
  const expected = expectedMoveFor(puzzle, linePly);
  const code = moveCode(move);
  return code === expected || `${move.from}${move.to}` === expected;
}

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function playPuzzleTone(type: "success" | "error") {
  if (typeof window === "undefined" || !getSettings().sounds) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = type === "success" ? 620 : 150;
  gain.gain.value = 0.035;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.1);
}

function clampRating(rating: number) {
  return Math.max(100, Math.min(2800, Math.round(rating)));
}

function ratingDelta(playerRating: number, puzzleRating: number, correct: boolean) {
  const expected = 1 / (1 + 10 ** ((puzzleRating - playerRating) / 400));
  const k = puzzleRating >= playerRating + 250 ? 40 : 32;
  return Math.round(k * ((correct ? 1 : 0) - expected));
}

function adaptivePuzzles(category: string, playerRating: number, solved: Record<string, PuzzleProgress>) {
  return puzzles
    .filter((puzzle) => category === "all" || puzzle.category === category)
    .sort((a, b) => {
      const aProgress = normalizeProgress(solved[a.id]);
      const bProgress = normalizeProgress(solved[b.id]);
      const aDistance = Math.abs(a.rating - playerRating);
      const bDistance = Math.abs(b.rating - playerRating);
      const solvedBias = Number(aProgress.solved) - Number(bProgress.solved);
      return aDistance - bDistance || solvedBias || a.rating - b.rating;
    });
}

export default function PuzzlesPage() {
  const { user } = useAuth();
  const categories = ["all", ...Array.from(new Set(puzzles.map((puzzle) => puzzle.category)))];
  const initialPuzzle = adaptivePuzzles("all", STARTING_PUZZLE_RATING, {})[0] ?? puzzles[0];
  const [category, setCategory] = useState("all");
  const [mode, setMode] = useState<PuzzleMode>("practice");
  const [currentPuzzleId, setCurrentPuzzleId] = useState(initialPuzzle.id);
  const [position, setPosition] = useState(initialPuzzle.fen);
  const [message, setMessage] = useState("Click a piece to see legal moves, then make the best move.");
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [answerSquares, setAnswerSquares] = useState<string[]>([]);
  const [linePly, setLinePly] = useState(0);
  const [runScore, setRunScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(RUSH_SECONDS);
  const [rushActive, setRushActive] = useState(false);
  const [solved, setSolved] = useState(() => getPuzzleState());
  const metaProgress = normalizeProgress(solved[SPECIAL_META_KEY]);
  const playerPuzzleRating = metaProgress.puzzleRating ?? STARTING_PUZZLE_RATING;
  const bestPuzzleRating = metaProgress.bestPuzzleRating ?? STARTING_PUZZLE_RATING;

  const filtered = useMemo(
    () => adaptivePuzzles(category, playerPuzzleRating, solved),
    [category, playerPuzzleRating, solved],
  );
  const puzzle =
    filtered.find((item) => item.id === currentPuzzleId) ??
    puzzles.find((item) => item.id === currentPuzzleId) ??
    filtered[0] ??
    puzzles[0];
  const puzzleProgress = normalizeProgress(solved[puzzle.id]);
  const rushProgress = normalizeProgress(solved[SPECIAL_RUSH_KEY]);
  const solvedCount = Object.entries(solved).filter(
    ([id, item]) => !id.startsWith("__") && item.solved,
  ).length;
  const totalScore = Object.entries(solved)
    .filter(([id]) => !id.startsWith("__"))
    .reduce((sum, [, item]) => sum + normalizeProgress(item).score, 0);
  const categoryStats = categories
    .filter((item) => item !== "all")
    .map((item) => {
      const categoryPuzzles = puzzles.filter((puzzleItem) => puzzleItem.category === item);
      const solvedInCategory = categoryPuzzles.filter((puzzleItem) => solved[puzzleItem.id]?.solved).length;
      return { category: item, solved: solvedInCategory, total: categoryPuzzles.length };
    });
  const selectedTargets = selectedSquare
    ? new Chess(position).moves({ square: selectedSquare as Square, verbose: true }).map((move) => move.to)
    : [];
  const disabled =
    (mode === "rush" && (!rushActive || timeLeft <= 0)) ||
    (mode === "survival" && lives <= 0);

  useEffect(() => {
    if (mode !== "rush" || !rushActive || timeLeft <= 0) return;
    const interval = window.setInterval(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [mode, rushActive, timeLeft]);

  useEffect(() => {
    if (!user) return;
    void fetchPuzzleProgressFromSupabase(user.id).then((remoteProgress) => {
      if (!remoteProgress) return;
      setSolved((current) => ({ ...current, ...remoteProgress }));
      setPuzzleState({ ...getPuzzleState(), ...remoteProgress });
    });
  }, [user]);

  function persist(next: Record<string, PuzzleProgress>) {
    setSolved(next);
    setPuzzleState(next);
    if (user) {
      for (const [puzzleId, progress] of Object.entries(next)) {
        if (!puzzleId.startsWith("__")) {
          void upsertPuzzleProgressToSupabase(user.id, puzzleId, progress).catch(() => {});
        }
      }
      if (next[SPECIAL_META_KEY]) {
        void upsertPuzzleProgressToSupabase(user.id, SPECIAL_META_KEY, next[SPECIAL_META_KEY]).catch(() => {});
      }
      if (next[SPECIAL_RUSH_KEY]) {
        void upsertPuzzleProgressToSupabase(user.id, SPECIAL_RUSH_KEY, next[SPECIAL_RUSH_KEY]).catch(() => {});
      }
    }
  }

  function withRatingUpdate(
    state: Record<string, PuzzleProgress>,
    correct: boolean,
  ) {
    const meta = normalizeProgress(state[SPECIAL_META_KEY]);
    const currentRating = meta.puzzleRating ?? STARTING_PUZZLE_RATING;
    const change = ratingDelta(currentRating, puzzle.rating, correct);
    const nextRating = clampRating(currentRating + change);

    return {
      nextState: {
        ...state,
        [SPECIAL_META_KEY]: {
          ...meta,
          puzzleRating: nextRating,
          bestPuzzleRating: Math.max(meta.bestPuzzleRating ?? STARTING_PUZZLE_RATING, nextRating),
        },
      },
      change,
      nextRating,
    };
  }

  function openPuzzle(nextIndex: number, source = filtered) {
    const nextPuzzle = source[nextIndex % source.length] ?? puzzles[0];
    setCurrentPuzzleId(nextPuzzle.id);
    setPosition(nextPuzzle.fen);
    setSelectedSquare(null);
    setAnswerSquares([]);
    setLinePly(0);
    setMessage(
      `Adaptive puzzle near your ${playerPuzzleRating} rating. Click a piece to see legal moves.`,
    );
  }

  function nextPuzzle() {
    const currentIndex = filtered.findIndex((item) => item.id === currentPuzzleId);
    openPuzzle((currentIndex === -1 ? 0 : currentIndex) + 1);
  }

  function changeCategory(nextCategory: string) {
    const nextFiltered = puzzles.filter(
      (item) => nextCategory === "all" || item.category === nextCategory,
    ).sort((a, b) => Math.abs(a.rating - playerPuzzleRating) - Math.abs(b.rating - playerPuzzleRating));
    setCategory(nextCategory);
    openPuzzle(0, nextFiltered);
  }

  function changeMode(nextMode: PuzzleMode) {
    setMode(nextMode);
    setRunScore(0);
    setStreak(0);
    setLives(3);
    setTimeLeft(RUSH_SECONDS);
    setRushActive(nextMode !== "rush");
    openPuzzle(0);
  }

  function startRush() {
    setRunScore(0);
    setStreak(0);
    setTimeLeft(RUSH_SECONDS);
    setRushActive(true);
    openPuzzle(0);
  }

  function failAttempt() {
    const nextStreak = 0;
    setStreak(nextStreak);
    if (mode === "survival") setLives((current) => Math.max(0, current - 1));
    if (mode === "rush") setRunScore((current) => Math.max(0, current - 3));
  }

  function awardScore(wasSolved: boolean) {
    const nextStreak = streak + 1;
    const streakBonus = Math.min(10, nextStreak * 2);
    const earned = puzzle.points + streakBonus;
    const nextRunScore = runScore + earned;
    const current = normalizeProgress(solved[puzzle.id]);
    const rushBest = Math.max(rushProgress.bestRushScore, nextRunScore);
    const baseState = {
      ...solved,
      [puzzle.id]: {
        ...current,
        solved: true,
        attempts: current.attempts + 1,
        score: wasSolved ? current.score : current.score + earned,
        currentStreak: nextStreak,
        bestStreak: Math.max(current.bestStreak, nextStreak),
        bestRushScore: current.bestRushScore,
        lastSolvedAt: new Date().toISOString(),
      },
      [SPECIAL_RUSH_KEY]: {
        ...rushProgress,
        bestRushScore: rushBest,
      },
    };
    const { nextState, change, nextRating } = withRatingUpdate(baseState, true);

    setStreak(nextStreak);
    setRunScore(nextRunScore);
    persist(nextState);
    return { earned, change, nextRating };
  }

  function tryMove(sourceSquare: string, targetSquare: string | null) {
    if (!targetSquare || disabled) return false;
    const chess = new Chess(position);

    try {
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });
      const current = normalizeProgress(solved[puzzle.id]);
      const correct = puzzle.line ? isExpectedMove(move, puzzle, linePly) : isPuzzleMove(move, puzzle);

      if (!correct) {
        const baseState = {
          ...solved,
          [puzzle.id]: {
            ...current,
            attempts: current.attempts + 1,
            currentStreak: 0,
          },
        };
        const { nextState, change, nextRating } = withRatingUpdate(baseState, false);
        persist(nextState);
        failAttempt();
        playPuzzleTone("error");
        setMessage(
          `Error: not quite (${change}). Rating ${nextRating}. Checks, captures, threats. Try to find the forcing move.`,
        );
        setSelectedSquare(null);
        return false;
      }

      setPosition(chess.fen());
      playPuzzleTone("success");
      setAnswerSquares([move.from, move.to]);
      setSelectedSquare(null);

      const nextLinePly = linePly + 1;
      const opponentReply = puzzle.line?.[nextLinePly];
      if (opponentReply) {
        window.setTimeout(() => {
          const replyBoard = new Chess(chess.fen());
          const reply = replyBoard.move({
            from: opponentReply.slice(0, 2),
            to: opponentReply.slice(2, 4),
            promotion: opponentReply[4] || "q",
          });
          setPosition(replyBoard.fen());
          setAnswerSquares([reply.from, reply.to]);
          setLinePly(nextLinePly + 1);
          setMessage("Success: good first move. Opponent replied. Find the next best move in the tactic.");
        }, 450);
        return true;
      }

      const { earned, change, nextRating } = awardScore(current.solved);
      setLinePly(0);
      setMessage(
        `Success: correct. +${earned} points, rating ${change >= 0 ? "+" : ""}${change} to ${nextRating}. ${puzzle.explanation}`,
      );
      if (mode === "rush") window.setTimeout(nextPuzzle, 650);
      return true;
    } catch {
      setMessage("That move is not legal in this position.");
      return false;
    }
  }

  function onSquareClick({ square }: { square: string }) {
    if (disabled) return;
    const chess = new Chess(position);
    const piece = chess.get(square as Square);

    if (selectedSquare && selectedTargets.includes(square as Square)) {
      tryMove(selectedSquare, square);
      return;
    }

    if (piece && piece.color === chess.turn()) {
      setSelectedSquare(square);
      setAnswerSquares([]);
      setMessage("Good. Now click one of the highlighted squares to check your answer.");
      return;
    }

    setSelectedSquare(null);
  }

  function showAnswer() {
    const expected = expectedMoveFor(puzzle, linePly);
    const source = expected.slice(0, 2);
    const target = expected.slice(2, 4);
    setAnswerSquares([source, target]);
    setSelectedSquare(source);
    setMessage(`Answer: ${source}-${target}. ${puzzle.explanation}`);
  }

  function showHint() {
    const expected = expectedMoveFor(puzzle, linePly);
    const source = expected.slice(0, 2);
    setSelectedSquare(source);
    setAnswerSquares([source]);
    setMessage(`Hint: ${puzzle.hint ?? "Look for checks, captures, and threats."}`);
  }

  const squareStyles = Object.fromEntries([
    ...(selectedSquare
      ? [[selectedSquare, { background: "rgba(96, 197, 141, 0.58)" }]]
      : []),
    ...selectedTargets.map((target) => [
      target,
      {
        background:
          "radial-gradient(circle, rgba(31, 122, 77, 0.48) 24%, transparent 27%)",
      },
    ]),
    ...answerSquares.map((square) => [
      square,
      { background: "rgba(240, 184, 77, 0.68)" },
    ]),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_25rem]">
      <Card className="p-3 sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4 px-1">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge>{puzzle.category}</Badge>
              <Badge>{puzzle.rating} rated</Badge>
              <Badge>Your rating: {playerPuzzleRating}</Badge>
              <Badge>{puzzle.points} base pts</Badge>
              {puzzle.line ? <Badge>{Math.ceil(puzzle.line.length / 2)}-move line</Badge> : null}
            </div>
            <h1 className="mt-2 text-3xl font-black">{puzzle.title}</h1>
          </div>
          <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
            <SelectField label="Mode" value={mode} onChange={(event) => changeMode(event.target.value as PuzzleMode)}>
              <option value="practice">Practice</option>
              <option value="rush">Puzzle Rush</option>
              <option value="survival">Survival</option>
            </SelectField>
            <SelectField label="Category" value={category} onChange={(event) => changeCategory(event.target.value)}>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </SelectField>
          </div>
        </div>
        <div className="mx-auto max-w-[min(82vh,720px)]">
          <Chessboard
            options={{
              position,
              boardOrientation: puzzle.sideToMove,
              onPieceDrop: ({ sourceSquare, targetSquare }) => tryMove(sourceSquare, targetSquare),
              onSquareClick,
              squareStyles,
              allowDragging: !disabled,
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
      </Card>

      <aside className="grid gap-4 content-start">
        <Card>
          <h2 className="text-xl font-black">Puzzle trainer</h2>
          <p className="mt-3 rounded-2xl bg-muted p-4 text-sm leading-6">{message}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {mode === "rush" ? (
              <Button onClick={startRush}>
                <Zap className="mr-2 h-4 w-4" />
                Start Rush
              </Button>
            ) : (
              <Button onClick={nextPuzzle}>Next Puzzle</Button>
            )}
            <Button variant="secondary" onClick={showHint}>
              <Lightbulb className="mr-2 h-4 w-4" />
              Hint
            </Button>
            <Button variant="secondary" onClick={showAnswer}>
              <Lightbulb className="mr-2 h-4 w-4" />
              Show solution
            </Button>
          </div>
          {disabled ? (
            <p className="mt-3 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
              {mode === "rush" ? "Rush is stopped. Start a new run." : "Survival over. Switch mode or reset."}
            </p>
          ) : null}
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <Trophy className="h-5 w-5 text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Run score</p>
            <p className="font-mono text-4xl font-black">{runScore}</p>
          </Card>
          <Card>
            <Flame className="h-5 w-5 text-accent" />
            <p className="mt-2 text-sm text-muted-foreground">Streak</p>
            <p className="font-mono text-4xl font-black">{streak}</p>
          </Card>
        </div>

        <Card>
          <div className="grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Puzzle rating</span>
              <span className="font-mono font-bold">{playerPuzzleRating}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Best rating</span>
              <span className="font-mono font-bold">{bestPuzzleRating}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total score</span>
              <span className="font-mono font-bold">{totalScore}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Solved puzzles</span>
              <span className="font-mono font-bold">{solvedCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Attempts here</span>
              <span className="font-mono font-bold">{puzzleProgress.attempts}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Timer className="h-4 w-4" />
                Rush clock
              </span>
              <span className="font-mono font-bold">{formatClock(timeLeft)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Heart className="h-4 w-4" />
                Survival lives
              </span>
              <span className="font-mono font-bold">{lives}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Best rush</span>
              <span className="font-mono font-bold">{rushProgress.bestRushScore}</span>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black">Puzzle leaderboard</h2>
          <div className="mt-4 grid gap-2 text-sm">
            {[
              ["You", playerPuzzleRating, totalScore],
              ["AminaTactics", 1530, 840],
              ["SamEndgame", 1320, 620],
            ].sort((a, b) => Number(b[1]) - Number(a[1])).map(([name, rating, score], index) => (
              <div key={name} className="flex items-center justify-between rounded-2xl bg-muted p-3">
                <span>{index + 1}. {name}</span>
                <span className="font-mono">{rating} / {score} pts</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black">Category stats</h2>
          <div className="mt-4 grid gap-2 text-sm">
            {categoryStats.map((item) => (
              <div key={item.category} className="flex items-center justify-between">
                <span className="capitalize text-muted-foreground">{item.category}</span>
                <span className="font-mono font-bold">{item.solved}/{item.total}</span>
              </div>
            ))}
          </div>
        </Card>
      </aside>
    </div>
  );
}
