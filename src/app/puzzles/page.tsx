"use client";

import { useEffect, useMemo, useState } from "react";
import { Chess, type Move, type Square } from "chess.js";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Eye,
  Flame,
  Heart,
  Lightbulb,
  RotateCcw,
  Swords,
  Tags,
  Target,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";
import { Chessboard } from "@/components/client-chessboard";
import { Badge, Button, Card, Field, SelectField } from "@/components/ui";
import { puzzles as rawPuzzles } from "@/lib/data";
import { getPuzzleState, getSettings, setPuzzleState } from "@/lib/storage";
import {
  fetchPuzzleProgressFromSupabase,
  upsertPuzzleProgressToSupabase,
} from "@/lib/supabase-data";
import type { Puzzle, PuzzleProgress } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";

type PuzzleView =
  | "home"
  | "rated"
  | "learning"
  | "rush"
  | "survival"
  | "battle"
  | "daily"
  | "themes"
  | "stats"
  | "mistakes";
type DifficultyMode = "adaptive" | "easy" | "medium" | "hard" | "custom";
type Feedback = "idle" | "correct" | "incorrect" | "solved" | "failed";

const STARTING_PUZZLE_RATING = 1500;
const SPECIAL_META_KEY = "__meta__";
const SPECIAL_RUSH_3_KEY = "__rush_3__";
const SPECIAL_RUSH_5_KEY = "__rush_5__";
const SPECIAL_SURVIVAL_KEY = "__survival__";
const SPECIAL_BATTLE_KEY = "__battle__";
const SPECIAL_DAILY_KEY = "__daily__";
const MAX_STRIKES = 3;
const BLOCKED_PUZZLE_IDS = new Set([
  "rated-clearance-1520",
  "rated-knight-fork-1850",
  "greek-gift-launch",
]);

const themeLabels: Record<string, string> = {
  "mate in 1": "Mate in 1",
  "mate in 2": "Mate in 2",
  fork: "Fork",
  pin: "Pin",
  skewer: "Skewer",
  "discovered attack": "Discovered Attack",
  "double attack": "Double Attack",
  "hanging piece": "Hanging Piece",
  sacrifice: "Sacrifice",
  defense: "Defense",
  promotion: "Promotion",
  deflection: "Deflection",
  clearance: "Clearance",
  "winning material": "Winning Material",
  endgame: "Endgame",
};

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
    failed: 0,
    solvedCount: 0,
    usedHint: false,
    usedSolution: false,
    solvingTimeMs: 0,
    ratingChange: 0,
  };
}

function normalizeProgress(progress?: Partial<PuzzleProgress>): PuzzleProgress {
  return { ...defaultProgress(), ...progress };
}

function isPlayablePuzzle(puzzle: Puzzle) {
  try {
    if (BLOCKED_PUZZLE_IDS.has(puzzle.id)) return false;
    const chess = new Chess(puzzle.fen);
    const expectedSide = puzzle.sideToMove === "white" ? "w" : "b";
    if (chess.turn() !== expectedSide) return false;
    const line = puzzle.line?.length ? puzzle.line : [puzzle.bestMove];
    if (line[0] !== puzzle.bestMove) return false;

    for (const uci of line) {
      const move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4] || "q",
      });
      if (!move) return false;
    }

    if (puzzle.category === "mate in 1" || puzzle.category === "mate in 2") {
      return chess.isCheckmate();
    }

    return true;
  } catch {
    return false;
  }
}

const puzzles = rawPuzzles.filter(isPlayablePuzzle);

function timestamp() {
  return Date.now();
}

function moveCode(move: Move) {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
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

function formatTime(ms: number) {
  if (!ms) return "--";
  return `${Math.max(1, Math.round(ms / 1000))}s`;
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

function ratingDelta(playerRating: number, puzzleRating: number, correct: boolean, hintPenalty = 0) {
  const expected = 1 / (1 + 10 ** ((puzzleRating - playerRating) / 400));
  const k = puzzleRating >= playerRating + 250 ? 40 : 32;
  return Math.round(k * ((correct ? 1 : 0) - expected) - hintPenalty);
}

function rangeForDifficulty(mode: DifficultyMode, customMin: number, customMax: number) {
  if (mode === "easy") return [400, 1200];
  if (mode === "medium") return [1200, 1800];
  if (mode === "hard") return [1800, 2800];
  if (mode === "custom") return [customMin, customMax];
  return null;
}

function dailyPuzzle() {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return puzzles[dayIndex % puzzles.length] ?? puzzles[0];
}

function randomIndex(max: number) {
  if (max <= 1) return 0;
  if (typeof crypto !== "undefined") {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function randomPuzzle(items: Puzzle[], fallback: Puzzle) {
  return items.length ? items[randomIndex(items.length)] : fallback;
}

function puzzleLineLength(puzzle: Puzzle) {
  return Math.ceil((puzzle.line?.length ?? 1) / 2);
}

export default function PuzzlesPage() {
  const { user } = useAuth();
  const [solved, setSolved] = useState(() => getPuzzleState());
  const [view, setView] = useState<PuzzleView>("home");
  const [theme, setTheme] = useState("mixed");
  const [difficultyMode, setDifficultyMode] = useState<DifficultyMode>("adaptive");
  const [customMin, setCustomMin] = useState(1200);
  const [customMax, setCustomMax] = useState(2000);
  const [rushSeconds, setRushSeconds] = useState(180);
  const [timeLeft, setTimeLeft] = useState(180);
  const [runActive, setRunActive] = useState(false);
  const [runScore, setRunScore] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [solvedIds, setSolvedIds] = useState<string[]>([]);
  const [recentPuzzleIds, setRecentPuzzleIds] = useState<string[]>([]);
  const [battleOpponentScore, setBattleOpponentScore] = useState(0);
  const [battleOpponent] = useState(() => ({ name: "AminaTactics", rating: 1530 }));
  const [currentPuzzleId, setCurrentPuzzleId] = useState(() => dailyPuzzle().id);
  const [position, setPosition] = useState(() => dailyPuzzle().fen);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [answerSquares, setAnswerSquares] = useState<string[]>([]);
  const [wrongSquares, setWrongSquares] = useState<string[]>([]);
  const [linePly, setLinePly] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [usedSolution, setUsedSolution] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [message, setMessage] = useState("Choose a puzzle mode to start training.");
  const [puzzleStartedAt, setPuzzleStartedAt] = useState(0);

  const categories = useMemo(
    () => ["mixed", ...Array.from(new Set(puzzles.map((puzzle) => puzzle.category)))],
    [],
  );
  const metaProgress = normalizeProgress(solved[SPECIAL_META_KEY]);
  const playerPuzzleRating = Math.max(
    STARTING_PUZZLE_RATING,
    metaProgress.puzzleRating ?? STARTING_PUZZLE_RATING,
  );
  const bestPuzzleRating = Math.max(
    STARTING_PUZZLE_RATING,
    metaProgress.bestPuzzleRating ?? STARTING_PUZZLE_RATING,
  );
  const currentPuzzle =
    puzzles.find((item) => item.id === currentPuzzleId) ?? dailyPuzzle() ?? puzzles[0];
  const puzzleProgress = normalizeProgress(solved[currentPuzzle.id]);
  const rushKey = rushSeconds === 300 ? SPECIAL_RUSH_5_KEY : SPECIAL_RUSH_3_KEY;
  const rushProgress = normalizeProgress(solved[rushKey]);
  const survivalProgress = normalizeProgress(solved[SPECIAL_SURVIVAL_KEY]);
  const battleProgress = normalizeProgress(solved[SPECIAL_BATTLE_KEY]);
  const dailyProgress = normalizeProgress(solved[SPECIAL_DAILY_KEY]);
  const canUseHints = view === "rated" || view === "learning" || view === "daily" || view === "mistakes";
  const canUseSolution = canUseHints;
  const isTimedMode = view === "rush" || view === "battle";
  const isStrikeMode = view === "rush" || view === "survival" || view === "battle";
  const runEnded =
    (isTimedMode && timeLeft <= 0) ||
    (isStrikeMode && strikes >= MAX_STRIKES && runActive) ||
    feedback === "failed";
  const boardDisabled =
    view === "home" ||
    view === "themes" ||
    view === "stats" ||
    feedback === "correct" ||
    feedback === "solved" ||
    feedback === "failed" ||
    (!runActive && (view === "rush" || view === "survival" || view === "battle")) ||
    runEnded;
  const selectedTargets = selectedSquare
    ? new Chess(position).moves({ square: selectedSquare as Square, verbose: true }).map((move) => move.to)
    : [];

  const filteredPuzzles = useMemo(() => {
    const range = rangeForDifficulty(difficultyMode, customMin, customMax);
    const targetRating =
      difficultyMode === "adaptive"
        ? Math.max(STARTING_PUZZLE_RATING, playerPuzzleRating + (view === "rush" || view === "survival" ? runScore * 25 : 100))
        : null;

    const list = puzzles
      .filter((puzzle) => theme === "mixed" || puzzle.category === theme)
      .filter((puzzle) => !range || (puzzle.rating >= range[0] && puzzle.rating <= range[1]))
      .sort((a, b) => {
        if (targetRating) {
          return Math.abs(a.rating - targetRating) - Math.abs(b.rating - targetRating);
        }
        return a.rating - b.rating;
      });

    return targetRating ? list.slice(0, Math.min(12, list.length)) : list;
  }, [customMax, customMin, difficultyMode, playerPuzzleRating, runScore, theme, view]);

  const mistakePuzzles = useMemo(
    () =>
      puzzles.filter((puzzle) => {
        const progress = normalizeProgress(solved[puzzle.id]);
        return (progress.failed ?? 0) > 0;
      }),
    [solved],
  );

  const solvedCount = Object.entries(solved).filter(
    ([id, item]) => !id.startsWith("__") && normalizeProgress(item).solved,
  ).length;
  const failedCount = Object.entries(solved)
    .filter(([id]) => !id.startsWith("__"))
    .reduce((sum, [, item]) => sum + (normalizeProgress(item).failed ?? 0), 0);
  const attemptsCount = Object.entries(solved)
    .filter(([id]) => !id.startsWith("__"))
    .reduce((sum, [, item]) => sum + normalizeProgress(item).attempts, 0);
  const accuracy = attemptsCount ? Math.round((solvedCount / attemptsCount) * 100) : 100;
  const averageTimeMs = (() => {
    const times = Object.entries(solved)
      .filter(([id]) => !id.startsWith("__"))
      .map(([, item]) => normalizeProgress(item).solvingTimeMs ?? 0)
      .filter(Boolean);
    return times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : 0;
  })();

  const themeStats = categories
    .filter((item) => item !== "mixed")
    .map((item) => {
      const themePuzzles = puzzles.filter((puzzle) => puzzle.category === item);
      const progress = themePuzzles.map((puzzle) => normalizeProgress(solved[puzzle.id]));
      const themeAttempts = progress.reduce((sum, itemProgress) => sum + itemProgress.attempts, 0);
      const themeSolved = progress.filter((itemProgress) => itemProgress.solved).length;
      const themeAccuracy = themeAttempts ? Math.round((themeSolved / themeAttempts) * 100) : 0;
      return {
        theme: item,
        total: themePuzzles.length,
        solved: themeSolved,
        accuracy: themeAccuracy,
      };
    });
  const weakestThemes = [...themeStats]
    .filter((item) => item.total > 0)
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
    .slice(0, 3);
  const strongestThemes = [...themeStats]
    .filter((item) => item.solved > 0)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 3);

  useEffect(() => {
    if (!user) return;
    void fetchPuzzleProgressFromSupabase(user.id).then((remoteProgress) => {
      if (!remoteProgress) return;
      setSolved((current) => ({ ...current, ...remoteProgress }));
      setPuzzleState({ ...getPuzzleState(), ...remoteProgress });
    });
  }, [user]);

  useEffect(() => {
    function resetPuzzlePage(event: Event) {
      if ((event as CustomEvent<string>).detail !== "/puzzles") return;
      setView("home");
      setRunActive(false);
      setFeedback("idle");
      setMessage("Choose a puzzle mode to start training.");
    }

    window.addEventListener("knightly:navigate-home", resetPuzzlePage);
    return () => window.removeEventListener("knightly:navigate-home", resetPuzzlePage);
  }, []);

  function persist(next: Record<string, PuzzleProgress>) {
    setSolved(next);
    setPuzzleState(next);
    if (user) {
      for (const [puzzleId, progress] of Object.entries(next)) {
        void upsertPuzzleProgressToSupabase(user.id, puzzleId, progress).catch(() => {});
      }
    }
  }

  function updateMetaRating(state: Record<string, PuzzleProgress>, correct: boolean, hintPenalty = 0) {
    const meta = normalizeProgress(state[SPECIAL_META_KEY]);
    const change = ratingDelta(playerPuzzleRating, currentPuzzle.rating, correct, hintPenalty);
    const nextRating = clampRating(playerPuzzleRating + change);

    return {
      change,
      nextRating,
      nextState: {
        ...state,
        [SPECIAL_META_KEY]: {
          ...meta,
          puzzleRating: nextRating,
          bestPuzzleRating: Math.max(meta.bestPuzzleRating ?? STARTING_PUZZLE_RATING, nextRating),
          currentStreak: correct ? (meta.currentStreak ?? 0) + 1 : 0,
          bestStreak: correct
            ? Math.max(meta.bestStreak ?? 0, (meta.currentStreak ?? 0) + 1)
            : meta.bestStreak ?? 0,
        },
      },
    };
  }

  function selectNextPuzzle(source = filteredPuzzles) {
    const list = view === "mistakes" && mistakePuzzles.length ? mistakePuzzles : source.length ? source : puzzles;
    const fresh = list.filter(
      (item) => item.id !== currentPuzzleId && !recentPuzzleIds.includes(item.id),
    );
    const candidates = fresh.length ? fresh : list.filter((item) => item.id !== currentPuzzleId);
    return randomPuzzle(candidates, randomPuzzle(list, puzzles[0]));
  }

  function openPuzzle(puzzle: Puzzle) {
    setCurrentPuzzleId(puzzle.id);
    setPosition(puzzle.fen);
    setSelectedSquare(null);
    setAnswerSquares([]);
    setWrongSquares([]);
    setLinePly(0);
    setHintLevel(0);
    setUsedSolution(false);
    setFeedback("idle");
    setMessage("Find the best forcing move.");
    setPuzzleStartedAt(timestamp());
    setRecentPuzzleIds((current) => [puzzle.id, ...current.filter((id) => id !== puzzle.id)].slice(0, 8));
  }

  function startMode(nextView: PuzzleView, options?: { seconds?: number; theme?: string }) {
    const nextTheme = options?.theme ?? (nextView === "daily" ? "mixed" : theme);
    if (options?.theme) setTheme(options.theme);
    setView(nextView);
    setRunScore(0);
    setStrikes(0);
    setStreak(0);
    setFailedIds([]);
    setSolvedIds([]);
    setBattleOpponentScore(0);
    setRunActive(!["home", "themes", "stats"].includes(nextView));
    if (options?.seconds) {
      setRushSeconds(options.seconds);
      setTimeLeft(options.seconds);
    } else if (nextView === "battle") {
      setRushSeconds(180);
      setTimeLeft(180);
    } else if (nextView !== "survival") {
      setTimeLeft(rushSeconds);
    }

    const source =
      nextView === "daily"
        ? [dailyPuzzle()]
        : nextView === "mistakes" && mistakePuzzles.length
          ? mistakePuzzles
          : puzzles.filter((puzzle) => nextTheme === "mixed" || puzzle.category === nextTheme);
    openPuzzle(randomPuzzle(source, puzzles[0]));
    setMessage(
      nextView === "rated"
        ? "Rated puzzle. No pressure, but rating is on the line."
        : nextView === "learning"
          ? "Learning mode. Hints are free and rating is safe."
          : nextView === "rush"
            ? "Puzzle Rush started. Three strikes ends the run."
            : nextView === "battle"
              ? `Puzzle Battle vs ${battleOpponent.name}. Solve faster than the opponent.`
              : "Find the best move.",
    );
  }

  function nextPuzzle() {
    if (view === "daily") {
      setMessage("Daily Puzzle can be solved once per day. Come back tomorrow for a new one.");
      return;
    }
    openPuzzle(selectNextPuzzle());
  }

  function finishRun() {
    if (!runActive) return;
    const key =
      view === "survival"
        ? SPECIAL_SURVIVAL_KEY
        : view === "battle"
          ? SPECIAL_BATTLE_KEY
          : rushKey;
    const current = normalizeProgress(solved[key]);
    const wonBattle = view === "battle" && runScore >= battleOpponentScore;
    const next = {
      ...solved,
      [key]: {
        ...current,
        score: Math.max(current.score, runScore),
        bestRushScore: Math.max(current.bestRushScore, runScore),
        attempts: current.attempts + 1,
        solvedCount: (current.solvedCount ?? 0) + solvedIds.length,
        failed: (current.failed ?? 0) + failedIds.length,
        lastSolvedAt: new Date().toISOString(),
        ratingChange: wonBattle ? 8 : view === "battle" ? -6 : 0,
      },
    };
    persist(next);
    setRunActive(false);
    setFeedback("failed");
    setMessage(
      view === "battle"
        ? `${wonBattle ? "Battle won" : "Battle lost"}: ${runScore}-${battleOpponentScore}.`
        : `Run finished. Score ${runScore}, accuracy ${runScore + failedIds.length ? Math.round((runScore / (runScore + failedIds.length)) * 100) : 100}%.`,
    );
  }

  useEffect(() => {
    if (!runActive || !isTimedMode || timeLeft <= 0) return;
    const interval = window.setInterval(() => {
      setTimeLeft((current) => {
        const next = Math.max(0, current - 1);
        if (next <= 0) window.setTimeout(() => finishRun(), 0);
        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimedMode, runActive, timeLeft]);

  useEffect(() => {
    if (!runActive || view !== "battle" || timeLeft <= 0 || strikes >= MAX_STRIKES) return;
    const interval = window.setInterval(() => {
      setBattleOpponentScore((current) => current + (Math.random() > 0.42 ? 1 : 0));
    }, 2800);

    return () => window.clearInterval(interval);
  }, [runActive, strikes, timeLeft, view]);

  function recordWrongMove(source: string, target: string, current: PuzzleProgress) {
    const solvingTimeMs = timestamp() - puzzleStartedAt;
    const baseProgress = {
      ...current,
      attempts: current.attempts + 1,
      failed: (current.failed ?? 0) + 1,
      currentStreak: 0,
      lastFailedAt: new Date().toISOString(),
      solvingTimeMs,
      usedHint: hintLevel > 0,
      usedSolution,
      puzzleMode: view,
    };
    const rated = view === "rated";
    const rating = rated ? updateMetaRating({ ...solved, [currentPuzzle.id]: baseProgress }, false) : null;
    const nextState = rating?.nextState ?? { ...solved, [currentPuzzle.id]: baseProgress };

    persist(nextState);
    setWrongSquares([source, target]);
    setAnswerSquares([]);
    setFeedback("incorrect");
    setStreak(0);
    setFailedIds((currentIds) =>
      currentIds.includes(currentPuzzle.id) ? currentIds : [...currentIds, currentPuzzle.id],
    );
    if (isStrikeMode) {
      setStrikes((currentStrikes) => {
        const nextStrikes = Math.min(MAX_STRIKES, currentStrikes + 1);
        if (nextStrikes >= MAX_STRIKES) window.setTimeout(() => finishRun(), 0);
        return nextStrikes;
      });
    }
    playPuzzleTone("error");
    setMessage(
      rated
        ? `Incorrect. ${rating?.change ?? 0} rating, now ${rating?.nextRating ?? playerPuzzleRating}. Try to calculate checks, captures, threats.`
        : "Incorrect. This puzzle is saved for Mistakes Review.",
    );
  }

  function recordSolved(current: PuzzleProgress, forceSolution = false) {
    const solvingTimeMs = timestamp() - puzzleStartedAt;
    const ratingMode = view === "rated";
    const solutionWasShown = forceSolution || usedSolution;
    const hintPenalty = ratingMode ? hintLevel * 3 + (solutionWasShown ? 12 : 0) : 0;
    const nextStreak = streak + 1;
    const puzzleScore = view === "rush" || view === "survival" || view === "battle" ? 1 : currentPuzzle.points;
    const puzzleRecord = {
      ...current,
      solved: !solutionWasShown,
      attempts: current.attempts + 1,
      score: current.score + (solutionWasShown ? 0 : puzzleScore),
      solvedCount: (current.solvedCount ?? 0) + (solutionWasShown ? 0 : 1),
      failed:
        view === "mistakes" && !solutionWasShown
          ? 0
          : (current.failed ?? 0) + (solutionWasShown ? 1 : 0),
      currentStreak: solutionWasShown ? 0 : nextStreak,
      bestStreak: solutionWasShown ? current.bestStreak : Math.max(current.bestStreak, nextStreak),
      usedHint: hintLevel > 0,
      usedSolution: solutionWasShown,
      solvingTimeMs,
      lastSolvedAt: new Date().toISOString(),
      puzzleMode: view,
    };
    const rating = ratingMode
      ? updateMetaRating({ ...solved, [currentPuzzle.id]: puzzleRecord }, !solutionWasShown, hintPenalty)
      : null;
    let nextState = rating?.nextState ?? { ...solved, [currentPuzzle.id]: puzzleRecord };

    if (view === "daily") {
      const today = new Date().toISOString().slice(0, 10);
      nextState = {
        ...nextState,
        [SPECIAL_DAILY_KEY]: {
          ...dailyProgress,
          solved: !solutionWasShown,
          score: dailyProgress.score + 1,
          currentStreak: (dailyProgress.currentStreak ?? 0) + 1,
          bestStreak: Math.max(dailyProgress.bestStreak ?? 0, (dailyProgress.currentStreak ?? 0) + 1),
          lastSolvedAt: today,
        },
      };
    }

    persist(nextState);
    setFeedback(solutionWasShown ? "failed" : "solved");
    setStreak(solutionWasShown ? 0 : nextStreak);
    setRunScore((currentScore) => currentScore + (solutionWasShown ? 0 : puzzleScore));
    setSolvedIds((currentIds) =>
      solutionWasShown || currentIds.includes(currentPuzzle.id) ? currentIds : [...currentIds, currentPuzzle.id],
    );
    playPuzzleTone("success");
    const ratingChange = rating?.change ?? 0;
    setMessage(
      ratingMode
        ? `${solutionWasShown ? "Solution shown" : "Correct"}. ${ratingChange >= 0 ? "+" : ""}${ratingChange} rating. ${currentPuzzle.explanation}`
        : `${solutionWasShown ? "Solution shown" : "Correct"}. ${currentPuzzle.explanation}`,
    );
    if (view === "rush" || view === "survival" || view === "battle") {
      window.setTimeout(() => {
        if (runActive && strikes < MAX_STRIKES && timeLeft > 0) openPuzzle(selectNextPuzzle());
      }, 650);
    }
  }

  function tryMove(sourceSquare: string, targetSquare: string | null) {
    if (!targetSquare || boardDisabled) return false;
    const chess = new Chess(position);

    try {
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });
      const current = normalizeProgress(solved[currentPuzzle.id]);
      const correct = isExpectedMove(move, currentPuzzle, linePly);

      if (!correct) {
        recordWrongMove(move.from, move.to, current);
        setSelectedSquare(null);
        return false;
      }

      setPosition(chess.fen());
      setWrongSquares([]);
      setAnswerSquares([move.from, move.to]);
      setSelectedSquare(null);
      setFeedback("correct");

      const nextLinePly = linePly + 1;
      const opponentReply = currentPuzzle.line?.[nextLinePly];
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
          setFeedback("idle");
          setMessage("Correct. Opponent replied. Continue the forcing line.");
        }, 420);
        return true;
      }

      setLinePly(0);
      recordSolved(current);
      return true;
    } catch {
      setMessage("That move is not legal in this position.");
      return false;
    }
  }

  function onSquareClick({ square }: { square: string }) {
    if (boardDisabled) return;
    const chess = new Chess(position);
    const piece = chess.get(square as Square);

    if (selectedSquare && selectedTargets.includes(square as Square)) {
      tryMove(selectedSquare, square);
      return;
    }

    if (piece && piece.color === chess.turn()) {
      setSelectedSquare(square);
      setWrongSquares([]);
      setMessage("Now choose the target square.");
      return;
    }

    setSelectedSquare(null);
  }

  function showHint() {
    if (!canUseHints) return;
    const nextHint = Math.min(3, hintLevel + 1);
    const expected = expectedMoveFor(currentPuzzle, linePly);
    setHintLevel(nextHint);
    if (nextHint >= 2) setSelectedSquare(expected.slice(0, 2));
    if (nextHint >= 3) setAnswerSquares([expected.slice(2, 4)]);
    setMessage(
      nextHint === 1
        ? `Hint: theme is ${themeLabels[currentPuzzle.category] ?? currentPuzzle.category}.`
        : nextHint === 2
          ? `Hint: move the piece from ${expected.slice(0, 2)}.`
          : `Hint: target square is ${expected.slice(2, 4)}.`,
    );
  }

  function showSolution() {
    if (!canUseSolution) return;
    const expected = expectedMoveFor(currentPuzzle, linePly);
    setUsedSolution(true);
    setAnswerSquares([expected.slice(0, 2), expected.slice(2, 4)]);
    setSelectedSquare(expected.slice(0, 2));
    setFeedback("failed");
    setStreak(0);
    const current = normalizeProgress(solved[currentPuzzle.id]);
    recordSolved(current, true);
    setMessage(`Solution: ${expected.slice(0, 2)}-${expected.slice(2, 4)}. ${currentPuzzle.explanation}`);
  }

  const squareStyles = Object.fromEntries([
    ...(selectedSquare ? [[selectedSquare, { background: "rgba(96, 197, 141, 0.58)" }]] : []),
    ...selectedTargets.map((target) => [
      target,
      { background: "radial-gradient(circle, rgba(31, 122, 77, 0.48) 24%, transparent 27%)" },
    ]),
    ...answerSquares.map((square) => [
      square,
      { background: "rgba(96, 197, 141, 0.62)" },
    ]),
    ...wrongSquares.map((square) => [
      square,
      { background: "rgba(248, 113, 113, 0.68)" },
    ]),
  ]);

  const modeCards = [
    {
      id: "rated" as PuzzleView,
      title: "Rated Puzzles",
      description: "Adaptive puzzles that change your puzzle rating.",
      icon: Target,
      best: `${playerPuzzleRating} rating`,
      action: () => startMode("rated"),
    },
    {
      id: "learning" as PuzzleView,
      title: "Learning Puzzles",
      description: "Hints, explanations, and no rating pressure.",
      icon: BookOpen,
      best: `${solvedCount} solved`,
      action: () => startMode("learning"),
    },
    {
      id: "rush" as PuzzleView,
      title: "Puzzle Rush",
      description: "3 or 5 minutes, harder puzzles, 3 strikes.",
      icon: Zap,
      best: `Best ${Math.max(normalizeProgress(solved[SPECIAL_RUSH_3_KEY]).bestRushScore, normalizeProgress(solved[SPECIAL_RUSH_5_KEY]).bestRushScore)}`,
      action: () => startMode("rush", { seconds: rushSeconds }),
    },
    {
      id: "battle" as PuzzleView,
      title: "Puzzle Battle",
      description: "Race an opponent on the same style sequence.",
      icon: Swords,
      best: `Best ${battleProgress.bestRushScore}`,
      action: () => startMode("battle", { seconds: 180 }),
    },
    {
      id: "daily" as PuzzleView,
      title: "Daily Puzzle",
      description: "One shared puzzle for today with daily streak.",
      icon: CalendarDays,
      best: `${dailyProgress.currentStreak ?? 0} day streak`,
      action: () => startMode("daily"),
    },
    {
      id: "themes" as PuzzleView,
      title: "Puzzle Themes",
      description: "Train forks, pins, mates, sacrifices, endgames.",
      icon: Tags,
      best: `${categories.length - 1} themes`,
      action: () => setView("themes"),
    },
    {
      id: "stats" as PuzzleView,
      title: "Puzzle Stats",
      description: "Rating, accuracy, streaks, strongest and weakest themes.",
      icon: BarChart3,
      best: `${accuracy}% accuracy`,
      action: () => setView("stats"),
    },
    {
      id: "mistakes" as PuzzleView,
      title: "Mistakes Review",
      description: "Repeat puzzles where you made mistakes.",
      icon: RotateCcw,
      best: `${mistakePuzzles.length} to review`,
      action: () => startMode("mistakes"),
    },
  ];

  if (view === "home") {
    return (
      <div className="grid gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge>Puzzle rating {playerPuzzleRating}</Badge>
            <h1 className="mt-3 text-3xl font-black">Puzzles</h1>
          </div>
          <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
            <SelectField label="Rush time" value={rushSeconds} onChange={(event) => setRushSeconds(Number(event.target.value))}>
              <option value={180}>3 minutes</option>
              <option value={300}>5 minutes</option>
            </SelectField>
            <SelectField label="Difficulty" value={difficultyMode} onChange={(event) => setDifficultyMode(event.target.value as DifficultyMode)}>
              <option value="adaptive">Adaptive</option>
              <option value="easy">Easy 400-1200</option>
              <option value="medium">Medium 1200-1800</option>
              <option value="hard">Hard 1800+</option>
              <option value="custom">Custom range</option>
            </SelectField>
          </div>
        </div>
        {difficultyMode === "custom" ? (
          <div className="grid gap-3 rounded-2xl bg-muted p-4 sm:grid-cols-2">
            <Field
              label="Min rating"
              type="number"
              value={customMin}
              onChange={(event) => setCustomMin(Number(event.target.value))}
            />
            <Field
              label="Max rating"
              type="number"
              value={customMax}
              onChange={(event) => setCustomMax(Number(event.target.value))}
            />
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {modeCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.id} className="grid min-h-56 content-between gap-4 rounded-2xl">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/16 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge>{card.best}</Badge>
                  </div>
                  <h2 className="mt-4 text-xl font-black">{card.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.description}</p>
                </div>
                <Button onClick={card.action}>Start</Button>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === "themes") {
    return (
      <div className="grid gap-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Badge>Puzzle Themes</Badge>
            <h1 className="mt-2 text-3xl font-black">Choose a Theme</h1>
          </div>
          <Button variant="secondary" onClick={() => setView("home")}>Back</Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {themeStats.map((item) => (
            <Card key={item.theme} className="rounded-2xl">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black">{themeLabels[item.theme] ?? item.theme}</h2>
                <Badge>{item.total} puzzles</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-muted p-3">
                  <p className="text-muted-foreground">Progress</p>
                  <p className="font-mono text-2xl font-black">{item.solved}/{item.total}</p>
                </div>
                <div className="rounded-xl bg-muted p-3">
                  <p className="text-muted-foreground">Accuracy</p>
                  <p className="font-mono text-2xl font-black">{item.accuracy}%</p>
                </div>
              </div>
              <Button className="mt-4 w-full" onClick={() => startMode("learning", { theme: item.theme })}>
                Start
              </Button>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (view === "stats") {
    return (
      <div className="grid gap-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Badge>Puzzle Stats</Badge>
            <h1 className="mt-2 text-3xl font-black">Training Profile</h1>
          </div>
          <Button variant="secondary" onClick={() => setView("home")}>Back</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Puzzle rating", playerPuzzleRating],
            ["Best rating", bestPuzzleRating],
            ["Solved", solvedCount],
            ["Failed", failedCount],
            ["Accuracy", `${accuracy}%`],
            ["Current streak", metaProgress.currentStreak ?? 0],
            ["Best streak", metaProgress.bestStreak ?? 0],
            ["Avg time", formatTime(averageTimeMs)],
          ].map(([label, value]) => (
            <Card key={label} className="rounded-2xl">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 font-mono text-4xl font-black">{value}</p>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-2xl">
            <h2 className="text-xl font-black">Strongest Themes</h2>
            <div className="mt-4 grid gap-2">
              {strongestThemes.map((item) => (
                <div key={item.theme} className="flex items-center justify-between rounded-xl bg-muted p-3 text-sm">
                  <span>{themeLabels[item.theme] ?? item.theme}</span>
                  <span className="font-mono font-bold">{item.accuracy}%</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="rounded-2xl">
            <h2 className="text-xl font-black">Weakest Themes</h2>
            <div className="mt-4 grid gap-2">
              {weakestThemes.map((item) => (
                <div key={item.theme} className="flex items-center justify-between rounded-xl bg-muted p-3 text-sm">
                  <span>{themeLabels[item.theme] ?? item.theme}</span>
                  <span className="font-mono font-bold">{item.accuracy}%</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_25rem]">
      <Card className="p-3 sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4 px-1">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge>{view === "mistakes" ? "Mistakes Review" : view}</Badge>
              <Badge>{themeLabels[currentPuzzle.category] ?? currentPuzzle.category}</Badge>
              <Badge>{currentPuzzle.rating} rated</Badge>
              <Badge>{puzzleLineLength(currentPuzzle)} move line</Badge>
            </div>
            <h1 className="mt-2 text-3xl font-black">{currentPuzzle.title}</h1>
          </div>
          <Button variant="secondary" onClick={() => setView("home")}>Modes</Button>
        </div>
        <div className="mx-auto max-w-[min(82vh,720px)]">
          <Chessboard
            options={{
              position,
              boardOrientation: currentPuzzle.sideToMove,
              onPieceDrop: ({ sourceSquare, targetSquare }) => tryMove(sourceSquare, targetSquare),
              onSquareClick,
              squareStyles,
              allowDragging: !boardDisabled,
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
        <Card className="rounded-2xl">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">
              {feedback === "solved" ? "Correct" : feedback === "incorrect" ? "Incorrect" : "Puzzle"}
            </h2>
            <Badge>{currentPuzzle.sideToMove === "white" ? "White to move" : "Black to move"}</Badge>
          </div>
          <p className="mt-3 rounded-xl bg-muted p-4 text-sm leading-6">{message}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {view === "rush" || view === "battle" || view === "survival" ? (
              <Button onClick={() => startMode(view, { seconds: view === "rush" ? rushSeconds : 180 })}>
                <Zap className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            ) : (
              <Button onClick={nextPuzzle}>Next Puzzle</Button>
            )}
            <Button variant="secondary" onClick={showHint} disabled={!canUseHints}>
              <Lightbulb className="mr-2 h-4 w-4" />
              Hint
            </Button>
            <Button variant="secondary" onClick={showSolution} disabled={!canUseSolution}>
              <Eye className="mr-2 h-4 w-4" />
              Solution
            </Button>
            <Button variant="secondary" onClick={() => startMode("mistakes")} disabled={!mistakePuzzles.length}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Review
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="rounded-2xl p-4">
            <Trophy className="h-5 w-5 text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Score</p>
            <p className="font-mono text-4xl font-black">{runScore}</p>
          </Card>
          <Card className="rounded-2xl p-4">
            <Flame className="h-5 w-5 text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Streak</p>
            <p className="font-mono text-4xl font-black">{streak}</p>
          </Card>
          <Card className="rounded-2xl p-4">
            <Heart className="h-5 w-5 text-destructive" />
            <p className="mt-2 text-sm text-muted-foreground">Strikes</p>
            <p className="font-mono text-4xl font-black">{strikes}/{MAX_STRIKES}</p>
          </Card>
          <Card className="rounded-2xl p-4">
            <Timer className="h-5 w-5 text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Timer</p>
            <p className="font-mono text-4xl font-black">{view === "survival" ? "--" : formatClock(timeLeft)}</p>
          </Card>
        </div>

        {view === "battle" ? (
          <Card className="rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black">Puzzle Battle</h2>
                <p className="text-sm text-muted-foreground">{battleOpponent.name} ({battleOpponent.rating})</p>
              </div>
              <Badge>{runScore}-{battleOpponentScore}</Badge>
            </div>
            <div className="mt-4 grid gap-2">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, runScore * 8)}%` }} />
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-destructive" style={{ width: `${Math.min(100, battleOpponentScore * 8)}%` }} />
              </div>
            </div>
          </Card>
        ) : null}

        <Card className="rounded-2xl">
          <h2 className="text-lg font-black">Stats</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Puzzle rating</span>
              <span className="font-mono font-bold">{playerPuzzleRating}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Best rating</span>
              <span className="font-mono font-bold">{bestPuzzleRating}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Attempts here</span>
              <span className="font-mono font-bold">{puzzleProgress.attempts}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Best rush</span>
              <span className="font-mono font-bold">{rushProgress.bestRushScore}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Best survival</span>
              <span className="font-mono font-bold">{survivalProgress.bestRushScore}</span>
            </div>
          </div>
        </Card>
      </aside>
    </div>
  );
}
