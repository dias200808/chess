export type GameMode = "local" | "bot" | "friend";
export type GameResult = "1-0" | "0-1" | "1/2-1/2" | "*";
export type BotDifficulty =
  | "elo-200"
  | "elo-400"
  | "elo-600"
  | "elo-800"
  | "elo-1000"
  | "elo-1200"
  | "elo-1400"
  | "elo-1600"
  | "elo-1800"
  | "elo-2000"
  | "elo-2200"
  | "elo-2400"
  | "stockfish";

export type UserProfile = {
  id: string;
  email: string;
  username: string;
  city: string;
  avatar: string;
  rating: number;
  gamesCount: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: string;
};

export type SavedGame = {
  id: string;
  whiteUserId?: string;
  blackUserId?: string;
  mode: GameMode;
  result: GameResult;
  winner: "white" | "black" | "draw" | null;
  opponent: string;
  moves: string[];
  pgn: string;
  finalPosition: string;
  whiteAccuracy: number;
  blackAccuracy: number;
  analysis: GameAnalysis;
  createdAt: string;
};

export type MoveEvaluation = {
  moveNumber: number;
  san: string;
  type:
    | "best move"
    | "good move"
    | "inaccuracy"
    | "mistake"
    | "blunder"
    | "missed win";
  scoreBefore: number;
  scoreAfter: number;
  note: string;
  bestMove?: string;
  engine?: "heuristic" | "stockfish";
};

export type GameAnalysis = {
  summary: string;
  whiteAccuracy: number;
  blackAccuracy: number;
  evaluations: MoveEvaluation[];
  bestMoment?: MoveEvaluation;
  worstMoment?: MoveEvaluation;
  trainingFocus: string;
};

export type Puzzle = {
  id: string;
  category:
    | "mate in 1"
    | "mate in 2"
    | "fork"
    | "pin"
    | "sacrifice"
    | "deflection"
    | "clearance"
    | "winning material"
    | "endgame";
  title: string;
  fen: string;
  bestMove: string;
  line?: string[];
  sideToMove: "white" | "black";
  explanation: string;
  rating: number;
  points: number;
};

export type PuzzleProgress = {
  solved: boolean;
  attempts: number;
  score: number;
  bestRushScore: number;
  currentStreak: number;
  bestStreak: number;
  puzzleRating?: number;
  bestPuzzleRating?: number;
  lastSolvedAt?: string;
};

export type Room = {
  id: string;
  link: string;
  whiteUserId?: string;
  blackUserId?: string;
  currentPosition?: string;
  moves?: string[];
  status: "waiting" | "ready" | "placeholder" | "finished";
  result?: string;
  createdAt: string;
  updatedAt?: string;
};
