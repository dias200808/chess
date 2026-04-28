import type {
  Assignment,
  AssignmentProgress,
  ChessSettings,
  Classroom,
  ClassroomInvitation,
  ClassroomJoinRequest,
  ClassroomMembership,
  ClassroomNotification,
  GuestSession,
  LessonProgress,
  PuzzleProgress,
  SavedGame,
  StudentActivity,
  TeacherComment,
  UserProfile,
} from "@/lib/types";

const PROFILE_KEY = "knightly.profiles";
const SESSION_KEY = "knightly.session";
const GAMES_KEY = "knightly.games";
const PUZZLES_KEY = "knightly.puzzles";
const PUZZLES_BY_USER_KEY = "knightly.puzzles-by-user";
const LESSON_PROGRESS_KEY = "knightly.lesson-progress";
const LESSON_PROGRESS_BY_USER_KEY = "knightly.lesson-progress-by-user";
const SETTINGS_KEY = "knightly.settings";
const LOCAL_CREDENTIALS_KEY = "knightly.local-credentials";
const GUEST_SESSION_KEY = "knightly.guest-session";
const CLASSROOMS_KEY = "knightly.classrooms";
const CLASSROOM_MEMBERSHIPS_KEY = "knightly.classroom-memberships";
const CLASSROOM_INVITATIONS_KEY = "knightly.classroom-invitations";
const CLASSROOM_REQUESTS_KEY = "knightly.classroom-requests";
const ASSIGNMENTS_KEY = "knightly.assignments";
const ASSIGNMENT_PROGRESS_KEY = "knightly.assignment-progress";
const TEACHER_COMMENTS_KEY = "knightly.teacher-comments";
const CLASSROOM_NOTIFICATIONS_KEY = "knightly.classroom-notifications";
const STUDENT_ACTIVITY_KEY = "knightly.student-activity";

type LocalCredential = {
  email: string;
  passwordHash: string;
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function fallbackGuestName() {
  const prefix = ["Guest", "Player", "Knight", "Pawn"][Math.floor(Math.random() * 4)] ?? "Guest";
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${suffix}`;
}

export function getProfiles() {
  return readJson<UserProfile[]>(PROFILE_KEY, []);
}

export function saveProfiles(profiles: UserProfile[]) {
  writeJson(PROFILE_KEY, profiles);
}

export function getClassrooms() {
  return readJson<Classroom[]>(CLASSROOMS_KEY, []);
}

export function saveClassrooms(items: Classroom[]) {
  writeJson(CLASSROOMS_KEY, items);
}

export function getClassroomMemberships() {
  return readJson<ClassroomMembership[]>(CLASSROOM_MEMBERSHIPS_KEY, []);
}

export function saveClassroomMemberships(items: ClassroomMembership[]) {
  writeJson(CLASSROOM_MEMBERSHIPS_KEY, items);
}

export function getClassroomInvitations() {
  return readJson<ClassroomInvitation[]>(CLASSROOM_INVITATIONS_KEY, []);
}

export function saveClassroomInvitations(items: ClassroomInvitation[]) {
  writeJson(CLASSROOM_INVITATIONS_KEY, items);
}

export function getClassroomJoinRequests() {
  return readJson<ClassroomJoinRequest[]>(CLASSROOM_REQUESTS_KEY, []);
}

export function saveClassroomJoinRequests(items: ClassroomJoinRequest[]) {
  writeJson(CLASSROOM_REQUESTS_KEY, items);
}

export function getAssignments() {
  return readJson<Assignment[]>(ASSIGNMENTS_KEY, []);
}

export function saveAssignments(items: Assignment[]) {
  writeJson(ASSIGNMENTS_KEY, items);
}

export function getAssignmentProgress() {
  return readJson<AssignmentProgress[]>(ASSIGNMENT_PROGRESS_KEY, []);
}

export function saveAssignmentProgress(items: AssignmentProgress[]) {
  writeJson(ASSIGNMENT_PROGRESS_KEY, items);
}

export function getTeacherComments() {
  return readJson<TeacherComment[]>(TEACHER_COMMENTS_KEY, []);
}

export function saveTeacherComments(items: TeacherComment[]) {
  writeJson(TEACHER_COMMENTS_KEY, items);
}

export function getClassroomNotifications() {
  return readJson<ClassroomNotification[]>(CLASSROOM_NOTIFICATIONS_KEY, []);
}

export function saveClassroomNotifications(items: ClassroomNotification[]) {
  writeJson(CLASSROOM_NOTIFICATIONS_KEY, items);
}

export function getLocalCredentials() {
  return readJson<LocalCredential[]>(LOCAL_CREDENTIALS_KEY, []);
}

export function saveLocalCredentials(credentials: LocalCredential[]) {
  writeJson(LOCAL_CREDENTIALS_KEY, credentials);
}

export function upsertLocalCredential(credential: LocalCredential) {
  const next = [
    credential,
    ...getLocalCredentials().filter(
      (item) => item.email.toLowerCase() !== credential.email.toLowerCase(),
    ),
  ];
  saveLocalCredentials(next);
}

export function getLocalCredentialByEmail(email: string) {
  return getLocalCredentials().find(
    (item) => item.email.toLowerCase() === email.toLowerCase(),
  );
}

export function getSessionUserId() {
  return readJson<string | null>(SESSION_KEY, null);
}

export function setSessionUserId(userId: string | null) {
  writeJson(SESSION_KEY, userId);
}

export function getSavedGames() {
  return readJson<SavedGame[]>(GAMES_KEY, []);
}

export function getSavedGamesSnapshot() {
  if (typeof window === "undefined") return "[]";
  return window.localStorage.getItem(GAMES_KEY) ?? "[]";
}

export function saveGame(game: SavedGame) {
  const games = getSavedGames();
  writeJson(GAMES_KEY, [game, ...games.filter((item) => item.id !== game.id)]);
}

export function getSavedGame(id: string) {
  return getSavedGames().find((game) => game.id === id);
}

function getSessionPuzzleOwnerId() {
  return getSessionUserId();
}

function getPuzzleStateMap() {
  return readJson<Record<string, Record<string, PuzzleProgress>>>(PUZZLES_BY_USER_KEY, {});
}

function getLessonProgressMap() {
  return readJson<Record<string, Record<string, LessonProgress>>>(LESSON_PROGRESS_BY_USER_KEY, {});
}

export function getPuzzleState(userId?: string) {
  const ownerId = userId ?? getSessionPuzzleOwnerId();
  const byUser = getPuzzleStateMap();
  if (ownerId && byUser[ownerId]) return byUser[ownerId];
  return readJson<Record<string, PuzzleProgress>>(PUZZLES_KEY, {});
}

export function getGuestSession() {
  return readJson<GuestSession | null>(GUEST_SESSION_KEY, null);
}

export function saveGuestSession(session: GuestSession) {
  writeJson(GUEST_SESSION_KEY, session);
}

export function ensureGuestSession() {
  const existing = getGuestSession();
  if (existing) return existing;
  const created: GuestSession = {
    id: crypto.randomUUID(),
    username: fallbackGuestName(),
    createdAt: new Date().toISOString(),
    transferableGameIds: [],
  };
  saveGuestSession(created);
  return created;
}

export function updateGuestSession(patch: Partial<GuestSession>) {
  const current = ensureGuestSession();
  const next: GuestSession = {
    ...current,
    ...patch,
    transferableGameIds: patch.transferableGameIds ?? current.transferableGameIds,
  };
  saveGuestSession(next);
  return next;
}

export function rememberGuestGame(gameId: string) {
  const current = ensureGuestSession();
  if (current.transferableGameIds.includes(gameId)) return current;
  return updateGuestSession({
    transferableGameIds: [gameId, ...current.transferableGameIds],
  });
}

export function clearGuestTransferableGames(gameIds: string[]) {
  if (!gameIds.length) return getGuestSession();
  const current = getGuestSession();
  if (!current) return current;
  const blocked = new Set(gameIds);
  return updateGuestSession({
    transferableGameIds: current.transferableGameIds.filter((gameId) => !blocked.has(gameId)),
  });
}

export function getAllPuzzleStates() {
  return getPuzzleStateMap();
}

export function setPuzzleState(
  state: Record<string, PuzzleProgress>,
  userId?: string,
) {
  const ownerId = userId ?? getSessionPuzzleOwnerId();
  if (ownerId) {
    const next = {
      ...getPuzzleStateMap(),
      [ownerId]: state,
    };
    writeJson(PUZZLES_BY_USER_KEY, next);
  }
  writeJson(PUZZLES_KEY, state);
}

export function getLessonProgress(userId?: string) {
  const ownerId = userId ?? getSessionUserId();
  const byUser = getLessonProgressMap();
  if (ownerId && byUser[ownerId]) return byUser[ownerId];
  return readJson<Record<string, LessonProgress>>(LESSON_PROGRESS_KEY, {});
}

export function setLessonProgress(state: Record<string, LessonProgress>, userId?: string) {
  const ownerId = userId ?? getSessionUserId();
  if (ownerId) {
    const next = {
      ...getLessonProgressMap(),
      [ownerId]: state,
    };
    writeJson(LESSON_PROGRESS_BY_USER_KEY, next);
  }
  writeJson(LESSON_PROGRESS_KEY, state);
}

export function getAllLessonProgress() {
  return getLessonProgressMap();
}

export function getStudentActivities(userId?: string) {
  const items = readJson<StudentActivity[]>(STUDENT_ACTIVITY_KEY, []);
  const filtered = userId ? items.filter((item) => item.userId === userId) : items;
  return filtered.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function saveStudentActivities(items: StudentActivity[]) {
  writeJson(STUDENT_ACTIVITY_KEY, items);
}

export function logStudentActivity(activity: Omit<StudentActivity, "id" | "createdAt">) {
  const next: StudentActivity = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...activity,
  };
  saveStudentActivities([next, ...getStudentActivities()]);
  return next;
}

export const defaultSettings: ChessSettings = {
  boardStyle: "forest",
  pieceStyle: "classic",
  backgroundTheme: "arena",
  sounds: true,
  boardCoordinates: true,
  legalMoves: true,
  lastMoveHighlight: true,
  autoQueen: false,
  premoves: true,
  moveConfirmation: false,
  animationSpeed: 180,
  zenMode: false,
};

export function getSettings(): ChessSettings {
  return {
    ...defaultSettings,
    ...readJson<Partial<ChessSettings>>(SETTINGS_KEY, {}),
  };
}

export function setSettings(settings: ChessSettings) {
  writeJson(SETTINGS_KEY, settings);
}
