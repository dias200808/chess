import type {
  AIStudentReport,
  Assignment,
  AssignmentProgress,
  Classroom,
  ClassroomInvitation,
  ClassroomJoinRequest,
  ClassroomMembership,
  MoveEvaluation,
  PuzzleProgress,
  SavedGame,
  StudentActivity,
  TeacherComment,
  UserProfile,
} from "@/lib/types";

export function classCodeFromName(name: string) {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 2)
    .padEnd(2, "A");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let index = 0; index < 4; index += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)] ?? "A";
  }
  return `${base}${suffix}`;
}

export function roleLabel(role?: UserProfile["role"]) {
  return role === "teacher" ? "Teacher" : "Student";
}

export function activeMembershipsForStudent(memberships: ClassroomMembership[], studentId: string) {
  return memberships.filter((item) => item.studentId === studentId && item.status === "active");
}

export function activeStudentsForClass(memberships: ClassroomMembership[], classId: string) {
  return memberships.filter((item) => item.classId === classId && item.status === "active");
}

function accuracyForGame(game: SavedGame, studentId: string) {
  if (game.whiteUserId === studentId) return game.whiteAccuracy;
  if (game.blackUserId === studentId) return game.blackAccuracy;
  return 0;
}

function studentGames(games: SavedGame[], studentId: string) {
  return games.filter((game) => game.whiteUserId === studentId || game.blackUserId === studentId);
}

export function averageAccuracyForStudent(games: SavedGame[], studentId: string) {
  const values = studentGames(games, studentId)
    .map((game) => accuracyForGame(game, studentId))
    .filter((value) => value > 0);
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function basicRecordForStudent(games: SavedGame[], studentId: string) {
  return studentGames(games, studentId).reduce(
    (record, game) => {
      if (game.winner === "draw" || game.result === "1/2-1/2") {
        record.draws += 1;
      } else {
        const side = game.whiteUserId === studentId ? "white" : game.blackUserId === studentId ? "black" : null;
        if (side && game.winner === side) record.wins += 1;
        else if (side) record.losses += 1;
      }
      return record;
    },
    { wins: 0, losses: 0, draws: 0 },
  );
}

function countMoveType(evaluations: MoveEvaluation[], type: MoveEvaluation["type"]) {
  return evaluations.filter((item) => item.type === type).length;
}

function latestEvaluations(games: SavedGame[]) {
  return games.flatMap((game) => game.analysis?.evaluations ?? []);
}

function puzzleStats(progressMap: Record<string, PuzzleProgress>) {
  const items = Object.entries(progressMap).filter(([id]) => !id.startsWith("__")).map(([, progress]) => progress);
  return {
    solved: items.filter((item) => item.solved).length,
    failed: items.reduce((sum, item) => sum + (item.failed ?? 0), 0),
    bestStreak: Math.max(0, ...items.map((item) => item.bestStreak ?? 0)),
  };
}

export function buildStudentPuzzleStats(progressMap: Record<string, PuzzleProgress>) {
  const stats = puzzleStats(progressMap);
  return {
    ...stats,
    recentSolved: Object.values(progressMap).filter((item) => item.solved && item.lastSolvedAt).length,
  };
}

export function buildAIStudentReport({
  student,
  games,
  puzzleProgress,
}: {
  student: UserProfile;
  games: SavedGame[];
  puzzleProgress: Record<string, PuzzleProgress>;
}): AIStudentReport {
  const recentGames = studentGames(games, student.id).slice(0, 12);
  const evaluations = latestEvaluations(recentGames);
  const blunders = countMoveType(evaluations, "blunder");
  const missedWins = countMoveType(evaluations, "missed win");
  const tacticalIssues = countMoveType(evaluations, "inaccuracy");
  const lowAccuracyGames = recentGames.filter((game) => accuracyForGame(game, student.id) > 0 && accuracyForGame(game, student.id) < 70).length;
  const stats = puzzleStats(puzzleProgress);

  const alerts: string[] = [];
  if (blunders >= 3) alerts.push("Blunders too often in recent games");
  if (missedWins >= 2) alerts.push("Misses winning chances in tactical positions");
  if (lowAccuracyGames >= 3) alerts.push("Recent accuracy trend is dropping");
  if (stats.solved < 5) alerts.push("Low recent puzzle volume");

  const weakestThemes = [
    blunders >= 3 ? "Queen safety" : null,
    tacticalIssues >= 4 ? "Knight forks" : null,
    missedWins >= 2 ? "Conversion" : null,
    lowAccuracyGames >= 3 ? "Time management" : null,
  ].filter(Boolean) as string[];

  const strongestThemes = [
    student.rapidRating >= student.blitzRating ? "Rapid decision-making" : null,
    stats.bestStreak >= 5 ? "Puzzle consistency" : null,
    recentGames.length >= 5 && blunders <= 1 ? "Board vision" : null,
  ].filter(Boolean) as string[];

  const mainIssue =
    blunders >= 3
      ? "Loose tactical discipline"
      : tacticalIssues >= 4
        ? "Misses forcing tactical ideas"
        : lowAccuracyGames >= 3
          ? "Accuracy drops in practical games"
          : "Needs steadier training volume";

  const commonMistake =
    blunders >= 3
      ? "Drops major material or queen under pressure"
      : missedWins >= 2
        ? "Misses strongest continuation after gaining advantage"
        : tacticalIssues >= 4
          ? "Does not prioritize checks, captures, and threats"
          : "Inconsistent calculation in equal positions";

  const openingWeakness =
    student.blitzRating > student.rapidRating
      ? "Loses structure when games slow down"
      : "Early development and center control need work";

  const endgameWeakness =
    lowAccuracyGames >= 3 || missedWins >= 2
      ? "Simplified endgames and rook conversions"
      : "Basic technical conversion after winning material";

  const recommendation =
    weakestThemes.length
      ? `Assign ${Math.max(10, weakestThemes.length * 5)} puzzles on ${weakestThemes[0].toLowerCase()} and review the last rapid game together.`
      : "Assign a balanced puzzle block, one opening lesson, and one reviewed rapid game.";

  return {
    studentId: student.id,
    mainIssue,
    commonMistake,
    openingWeakness,
    endgameWeakness,
    recommendation,
    alerts,
    strongestThemes,
    weakestThemes,
    insights: [
      {
        issue: mainIssue,
        recommendation,
        severity: blunders >= 3 || lowAccuracyGames >= 3 ? "high" : "medium",
      },
      {
        issue: commonMistake,
        recommendation: "Review forcing moves before each candidate move.",
        severity: tacticalIssues >= 4 ? "high" : "low",
      },
    ],
  };
}

export function buildTeacherDashboard({
  teacher,
  profiles,
  classes,
  memberships,
  requests,
  assignments,
  assignmentProgress,
  invitations,
  games,
  notifications,
  activities,
}: {
  teacher: UserProfile;
  profiles: UserProfile[];
  classes: Classroom[];
  memberships: ClassroomMembership[];
  requests: ClassroomJoinRequest[];
  assignments: Assignment[];
  assignmentProgress: AssignmentProgress[];
  invitations: ClassroomInvitation[];
  games: SavedGame[];
  notifications: { userId: string; type: string; read: boolean; createdAt: string }[];
  activities: StudentActivity[];
}) {
  const teacherClasses = classes.filter((item) => item.teacherId === teacher.id);
  const classIds = new Set(teacherClasses.map((item) => item.id));
  const activeMemberships = memberships.filter((item) => classIds.has(item.classId) && item.status === "active");
  const studentIds = [...new Set(activeMemberships.map((item) => item.studentId))];
  const students = profiles.filter((profile) => studentIds.includes(profile.id));
  const today = new Date().toISOString().slice(0, 10);
  const todayGames = games.filter((game) => studentIds.includes(game.whiteUserId ?? "") || studentIds.includes(game.blackUserId ?? ""));
  const studentActivities = activities.filter((item) => studentIds.includes(item.userId));
  const todayActivities = studentActivities.filter((item) => item.createdAt.slice(0, 10) === today);
  const lowActivityStudents = students
    .filter((student) => {
      const lastActivity = studentActivities.find((item) => item.userId === student.id);
      if (!lastActivity) return true;
      return Date.now() - Date.parse(lastActivity.createdAt) > 3 * 24 * 60 * 60 * 1000;
    })
    .slice(0, 5);

  return {
    teacherClasses,
    students,
    totalStudents: students.length,
    activeStudentsToday: students.filter((student) => todayGames.some((game) => (game.whiteUserId === student.id || game.blackUserId === student.id) && game.createdAt.slice(0, 10) === today)).length,
    gamesToday: todayGames.filter((game) => game.createdAt.slice(0, 10) === today).length,
    puzzlesSolvedToday: todayActivities.filter((item) => item.type === "solved_puzzle").length,
    pendingJoinRequests: requests.filter((item) => item.teacherId === teacher.id && item.status === "pending").length,
    pendingInvitations: invitations.filter((item) => item.teacherId === teacher.id && item.status === "invited").length,
    pendingAssignments: assignmentProgress.filter((item) => {
      const assignment = assignments.find((candidate) => candidate.id === item.assignmentId);
      return assignment?.teacherId === teacher.id && item.status !== "completed";
    }).length,
    aiAlerts: notifications.filter((item) => item.userId === teacher.id && item.type === "ai_alert" && !item.read).length,
    recentActivity: todayActivities.slice(0, 8),
    lowActivityStudents,
  };
}

export function buildClassLeaderboard({
  students,
  games,
  puzzleProgressByStudent,
  assignmentProgress,
}: {
  students: UserProfile[];
  games: SavedGame[];
  puzzleProgressByStudent: Record<string, Record<string, PuzzleProgress>>;
  assignmentProgress: AssignmentProgress[];
}) {
  return students
    .map((student) => {
      const studentGameCount = studentGames(games, student.id).length;
      const puzzleStatsForStudent = puzzleStats(puzzleProgressByStudent[student.id] ?? {});
      const completedAssignments = assignmentProgress.filter((item) => item.studentId === student.id && item.status === "completed").length;
      const activityScore = studentGameCount * 4 + puzzleStatsForStudent.solved * 2 + completedAssignments * 5 + (student.puzzleRating - 1200) / 40;
      return {
        student,
        completedAssignments,
        activityScore: Math.round(activityScore),
        solvedPuzzles: puzzleStatsForStudent.solved,
      };
    })
    .sort((a, b) => b.activityScore - a.activityScore || b.student.rating - a.student.rating);
}

export function pendingCommentsForStudent(comments: TeacherComment[], studentId: string) {
  return comments.filter((item) => item.studentId === studentId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
