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

export type TimeControl = {
  id: string;
  label: string;
  initialSeconds: number | null;
  incrementSeconds: number;
};

export type ChessSettings = {
  boardStyle: "forest" | "sand" | "classic" | "blue" | "mono";
  pieceStyle: "classic" | "modern" | "alpha";
  backgroundTheme: "arena" | "plain" | "wood" | "midnight";
  sounds: boolean;
  boardCoordinates: boolean;
  legalMoves: boolean;
  lastMoveHighlight: boolean;
  autoQueen: boolean;
  premoves: boolean;
  moveConfirmation: boolean;
  animationSpeed: number;
  zenMode: boolean;
};

export type RatingType = "bullet" | "blitz" | "rapid" | "classical" | "puzzle";

export type UserProfile = {
  id: string;
  email: string;
  username: string;
  city: string;
  country: string;
  avatar: string;
  rating: number;
  bulletRating: number;
  blitzRating: number;
  rapidRating: number;
  classicalRating: number;
  puzzleRating: number;
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
  whitePlayer: string;
  blackPlayer: string;
  mode: GameMode;
  result: GameResult;
  winner: "white" | "black" | "draw" | null;
  endReason: string;
  opponent: string;
  moves: string[];
  pgn: string;
  finalPosition: string;
  timeControl?: string;
  rated?: boolean;
  ratingType?: RatingType;
  ratingBefore?: number;
  ratingAfter?: number;
  ratingChange?: number;
  whiteAccuracy: number;
  blackAccuracy: number;
  analysis: GameAnalysis;
  createdAt: string;
};

export type MoveEvaluation = {
  ply: number;
  moveNumber: number;
  color: "w" | "b";
  san: string;
  uci?: string;
  type:
    | "brilliant"
    | "best move"
    | "excellent"
    | "good move"
    | "inaccuracy"
    | "mistake"
    | "blunder"
    | "missed win"
    | "checkmate";
  centipawnLoss?: number;
  scoreBefore: number;
  scoreAfter: number;
  mateBefore?: number;
  mateAfter?: number;
  note: string;
  bestMove?: string;
  bestMoveUci?: string;
  fenBefore?: string;
  fenAfter?: string;
  engine?: "heuristic" | "stockfish";
};

export type GameAnalysis = {
  summary: string;
  whiteAccuracy: number;
  blackAccuracy: number;
  evaluations: MoveEvaluation[];
  bestMoment?: MoveEvaluation;
  worstMoment?: MoveEvaluation;
  keyMoments?: MoveEvaluation[];
  trainingFocus: string;
};

export type Puzzle = {
  id: string;
  category:
    | "mate in 1"
    | "mate in 2"
    | "fork"
    | "pin"
    | "skewer"
    | "discovered attack"
    | "double attack"
    | "hanging piece"
    | "sacrifice"
    | "defense"
    | "promotion"
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
  hint?: string;
  rating: number;
  points: number;
};

export type Lesson = {
  id: string;
  category:
    | "how pieces move"
    | "check"
    | "checkmate"
    | "castling"
    | "opening principles"
    | "basic tactics"
    | "forks"
    | "pins"
    | "endgames"
    | "king safety"
    | "common mistakes";
  title: string;
  fen: string;
  sideToMove: "white" | "black";
  explanation: string;
  task: string;
  answer: string;
  hint: string;
  success: string;
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
  failed?: number;
  solvedCount?: number;
  usedHint?: boolean;
  usedSolution?: boolean;
  solvingTimeMs?: number;
  ratingChange?: number;
  lastFailedAt?: string;
  puzzleMode?: string;
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
  timeControl?: string;
  matchType?: "invite" | "quick";
  hostKey?: string;
  guestKey?: string;
  hostRating?: number;
  guestRating?: number;
  whiteTimeMs?: number | null;
  blackTimeMs?: number | null;
  incrementSeconds?: number;
  lastMoveAt?: string | null;
  whiteConnectedAt?: string | null;
  blackConnectedAt?: string | null;
  drawOfferedBy?: "white" | "black" | null;
  endReason?: string;
  rated?: boolean;
  createdAt: string;
  updatedAt?: string;
};
