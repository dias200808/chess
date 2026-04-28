export type GameMode = "local" | "bot" | "friend" | "online";
export type GameResult = "1-0" | "0-1" | "1/2-1/2" | "*";
export type PlayerKind = "guest" | "account";
export type OnlineGameType = "casual" | "rated";
export type OnlineMatchType = "invite" | "quick";
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

export type PuzzleTheme =
  | "mate in 1"
  | "mate in 2"
  | "mate in 3"
  | "fork"
  | "pin"
  | "skewer"
  | "discovered attack"
  | "double attack"
  | "back rank mate"
  | "hanging piece"
  | "endgame"
  | "promotion"
  | "sacrifice"
  | "defense"
  | "opening trap"
  | "deflection"
  | "clearance"
  | "winning material";

export type PuzzleDifficulty = "easy" | "medium" | "hard" | "expert";
export type AccountRole = "student" | "teacher";
export type TeacherVerification = "unverified" | "pending" | "verified";
export type ClassLevel = "beginner" | "intermediate" | "advanced" | "mixed";
export type MembershipStatus = "active" | "pending" | "invited" | "rejected" | "declined";
export type AssignmentType = "puzzles" | "lessons" | "games" | "opening" | "review";
export type AssignmentStatus = "open" | "completed" | "overdue";
export type CommentTargetType = "game" | "move" | "puzzle" | "lesson" | "assignment";
export type NotificationType =
  | "join_request"
  | "invitation"
  | "assignment"
  | "assignment_completed"
  | "teacher_comment"
  | "ai_alert"
  | "activity_warning";

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
  fullName?: string;
  role?: AccountRole;
  schoolName?: string;
  age?: number | null;
  teacherVerification?: TeacherVerification;
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

export type Classroom = {
  id: string;
  teacherId: string;
  name: string;
  code: string;
  description: string;
  level: ClassLevel;
  createdAt: string;
};

export type ClassroomMembership = {
  id: string;
  classId: string;
  teacherId: string;
  studentId: string;
  status: MembershipStatus;
  requestedAt: string;
  respondedAt?: string;
};

export type ClassroomInvitation = {
  id: string;
  classId: string;
  teacherId: string;
  studentId: string;
  status: MembershipStatus;
  message?: string;
  createdAt: string;
  respondedAt?: string;
};

export type ClassroomJoinRequest = {
  id: string;
  classId: string;
  teacherId: string;
  studentId: string;
  message?: string;
  status: MembershipStatus;
  createdAt: string;
  respondedAt?: string;
};

export type Assignment = {
  id: string;
  classId: string;
  teacherId: string;
  studentId?: string;
  lessonId?: string;
  title: string;
  description: string;
  type: AssignmentType;
  createdAt: string;
  dueDate?: string;
  targetCount?: number;
  theme?: string;
  opening?: string;
};

export type AssignmentProgress = {
  id: string;
  assignmentId: string;
  studentId: string;
  status: AssignmentStatus;
  completionPercent: number;
  completedCount: number;
  accuracy?: number;
  notes?: string;
  updatedAt: string;
  completedAt?: string;
};

export type TeacherComment = {
  id: string;
  teacherId: string;
  studentId: string;
  targetType: CommentTargetType;
  targetId: string;
  moveNumber?: number;
  comment: string;
  createdAt: string;
};

export type ClassroomNotification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  relatedId?: string;
};

export type StudentActivityType =
  | "login"
  | "started_lesson"
  | "completed_lesson"
  | "solved_puzzle"
  | "failed_puzzle"
  | "played_game"
  | "completed_assignment"
  | "analyzed_game";

export type StudentActivity = {
  id: string;
  userId: string;
  type: StudentActivityType;
  createdAt: string;
  title: string;
  details?: string;
  relatedId?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

export type StudentInsight = {
  issue: string;
  recommendation: string;
  severity: "low" | "medium" | "high";
};

export type AIStudentReport = {
  studentId: string;
  mainIssue: string;
  commonMistake: string;
  openingWeakness: string;
  endgameWeakness: string;
  recommendation: string;
  alerts: string[];
  strongestThemes: string[];
  weakestThemes: string[];
  insights: StudentInsight[];
};

export type SavedGame = {
  id: string;
  whiteUserId?: string;
  blackUserId?: string;
  whiteGuestKey?: string;
  blackGuestKey?: string;
  whitePlayer: string;
  blackPlayer: string;
  mode: GameMode;
  matchType?: OnlineMatchType;
  result: GameResult;
  winner: "white" | "black" | "draw" | null;
  endReason: string;
  opponent: string;
  moves: string[];
  pgn: string;
  finalPosition: string;
  timeControl?: string;
  gameType?: OnlineGameType;
  rated?: boolean;
  ratingType?: RatingType;
  ratingBefore?: number;
  ratingAfter?: number;
  ratingChange?: number;
  whiteRatingBefore?: number;
  whiteRatingAfter?: number;
  whiteRatingChange?: number;
  blackRatingBefore?: number;
  blackRatingAfter?: number;
  blackRatingChange?: number;
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
  category: PuzzleTheme;
  title: string;
  fen: string;
  bestMove: string;
  line?: string[];
  sideToMove: "white" | "black";
  explanation: string;
  hint?: string;
  rating: number;
  points: number;
  difficulty?: PuzzleDifficulty;
  themes?: PuzzleTheme[];
  opening?: string;
  sourceGame?: string;
  popularity?: number;
  playsCount?: number;
  winPercentage?: number;
  externalId?: string;
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

export type LessonProgress = {
  started: boolean;
  completed: boolean;
  attempts: number;
  quizPassed: boolean;
  startedAt?: string;
  completedAt?: string;
  lastSeenAt?: string;
  timeSpentMs?: number;
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
  whitePlayer?: string;
  blackPlayer?: string;
  whitePlayerType?: PlayerKind;
  blackPlayerType?: PlayerKind;
  whiteRating?: number;
  blackRating?: number;
  currentPosition?: string;
  moves?: string[];
  status: "waiting" | "ready" | "placeholder" | "finished";
  result?: string;
  timeControl?: string;
  matchType?: OnlineMatchType;
  gameType?: OnlineGameType;
  hostKey?: string;
  guestKey?: string;
  hostRating?: number;
  guestRating?: number;
  whiteTimeMs?: number | null;
  blackTimeMs?: number | null;
  incrementSeconds?: number;
  lastMoveAt?: string | null;
  readyAt?: string | null;
  connectDeadlineAt?: string | null;
  firstMoveDeadlineAt?: string | null;
  whiteConnectedAt?: string | null;
  blackConnectedAt?: string | null;
  drawOfferedBy?: "white" | "black" | null;
  drawOfferPly?: number | null;
  whiteDrawBlockedUntilPly?: number | null;
  blackDrawBlockedUntilPly?: number | null;
  rematchRequestedBy?: "white" | "black" | null;
  rematchRoomId?: string | null;
  endReason?: string;
  rated?: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type GuestSession = {
  id: string;
  username: string;
  createdAt: string;
  transferableGameIds: string[];
};
