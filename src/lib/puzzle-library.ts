import { puzzles as seedPuzzles } from "@/lib/data";
import { lichessPuzzles } from "@/lib/generated/lichess-puzzles";
import type { Puzzle, PuzzleDifficulty, PuzzleTheme } from "@/lib/types";

const themeAliases: Partial<Record<PuzzleTheme, PuzzleTheme[]>> = {
  "mate in 1": ["back rank mate"],
  "mate in 2": ["back rank mate"],
  sacrifice: ["opening trap"],
  endgame: ["defense"],
};

const themeExplanations: Partial<Record<PuzzleTheme, string>> = {
  "mate in 1": "A direct mating shot where one forcing move ends the game immediately.",
  "mate in 2": "A forcing sequence where the first move creates an unavoidable mate on the next turn.",
  "mate in 3": "A longer forcing mating net where every reply is controlled.",
  fork: "One move attacks two valuable targets at the same time.",
  pin: "A piece is stuck because moving it would expose a more valuable piece behind it.",
  skewer: "A long-range piece attacks a valuable piece first, then wins the piece behind it.",
  "discovered attack": "Moving one piece opens a line for another piece to attack.",
  "double attack": "A single move creates two threats at once.",
  "back rank mate": "The king has no escape squares on the back rank and gets mated there.",
  "hanging piece": "A loose undefended piece can be won immediately.",
  endgame: "Technique matters: king activity, passed pawns, and precise tempo play decide the result.",
  promotion: "The key idea is queening at the right moment, often with tempo or check.",
  sacrifice: "Material is invested to open lines, expose the king, or force a winning tactic.",
  defense: "The best move prevents an immediate threat before starting your own plan.",
  "opening trap": "The tactic comes from a common opening pattern, usually punishing a known mistake.",
  deflection: "A defender is dragged away from an important square, file, or diagonal.",
  clearance: "A piece moves away to open a line or square for a stronger follow-up.",
  "winning material": "The tactic wins a queen, rook, or another decisive amount of material.",
};

function difficultyForRating(rating: number): PuzzleDifficulty {
  if (rating < 1200) return "easy";
  if (rating < 1600) return "medium";
  if (rating < 2000) return "hard";
  return "expert";
}

function popularityForRating(rating: number) {
  return Math.max(40, 100 - Math.floor((rating - 800) / 25));
}

function playsCountForRating(rating: number) {
  return Math.max(250, 12_000 - Math.floor((rating - 800) * 4));
}

function winRateForRating(rating: number) {
  return Math.max(32, Math.min(88, 74 - Math.floor((rating - 1200) / 30)));
}

function openingForPuzzle(puzzle: Puzzle) {
  if (puzzle.category === "opening trap") return "Opening Trap";
  if (puzzle.category === "mate in 1" || puzzle.category === "mate in 2") return "Back Rank Patterns";
  if (puzzle.category === "endgame") return "King and Pawn Endgame";
  return undefined;
}

function sourceGameForPuzzle(puzzle: Puzzle) {
  return `training:${puzzle.id}`;
}

function explanationForPuzzle(puzzle: Puzzle, themes: PuzzleTheme[]) {
  if (puzzle.explanation?.trim()) return puzzle.explanation;
  const primary = themes[0];
  return themeExplanations[primary] ?? "Find the forcing move and follow the tactical idea to its conclusion.";
}

function enrichPuzzle(puzzle: Puzzle): Puzzle {
  const themes = Array.from(new Set([puzzle.category, ...(themeAliases[puzzle.category] ?? []), ...(puzzle.themes ?? [])]));
  return {
    ...puzzle,
    difficulty: puzzle.difficulty ?? difficultyForRating(puzzle.rating),
    themes,
    opening: puzzle.opening ?? openingForPuzzle(puzzle),
    sourceGame: puzzle.sourceGame ?? sourceGameForPuzzle(puzzle),
    popularity: puzzle.popularity ?? popularityForRating(puzzle.rating),
    playsCount: puzzle.playsCount ?? playsCountForRating(puzzle.rating),
    winPercentage: puzzle.winPercentage ?? winRateForRating(puzzle.rating),
    explanation: explanationForPuzzle(puzzle, themes),
  };
}

function mergePuzzleSources() {
  const primary = lichessPuzzles.length ? lichessPuzzles : [];
  const secondary = seedPuzzles;
  const byId = new Map<string, Puzzle>();

  for (const puzzle of [...primary, ...secondary]) {
    if (!byId.has(puzzle.id)) {
      byId.set(puzzle.id, puzzle);
    }
  }

  return [...byId.values()];
}

export const puzzleLibrary: Puzzle[] = mergePuzzleSources().map(enrichPuzzle);
export const puzzleSourceSummary = {
  source: lichessPuzzles.length ? "lichess+seed" : "seed",
  lichessCount: lichessPuzzles.length,
  totalCount: puzzleLibrary.length,
};

export function difficultyRange(mode: PuzzleDifficulty | "adaptive" | "custom", rating: number, custom?: { min: number; max: number }) {
  if (mode === "easy") return [800, 1200] as const;
  if (mode === "medium") return [1200, 1600] as const;
  if (mode === "hard") return [1600, 2000] as const;
  if (mode === "expert") return [2000, 3200] as const;
  if (mode === "custom" && custom) return [custom.min, custom.max] as const;
  return [Math.max(800, rating - 200), Math.min(3200, rating + 200)] as const;
}

export function filterPuzzles({
  theme = "mixed",
  minRating,
  maxRating,
}: {
  theme?: PuzzleTheme | "mixed";
  minRating?: number;
  maxRating?: number;
}) {
  return puzzleLibrary.filter((puzzle) => {
    if (theme !== "mixed" && !(puzzle.themes ?? [puzzle.category]).includes(theme)) return false;
    if (typeof minRating === "number" && puzzle.rating < minRating) return false;
    if (typeof maxRating === "number" && puzzle.rating > maxRating) return false;
    return true;
  });
}

export function dailyPuzzleForDate(date = new Date()) {
  const dayIndex = Math.floor(date.getTime() / 86_400_000);
  return puzzleLibrary[dayIndex % puzzleLibrary.length] ?? puzzleLibrary[0];
}
