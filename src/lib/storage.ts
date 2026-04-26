import type { PuzzleProgress, SavedGame, UserProfile } from "@/lib/types";

const PROFILE_KEY = "knightly.profiles";
const SESSION_KEY = "knightly.session";
const GAMES_KEY = "knightly.games";
const PUZZLES_KEY = "knightly.puzzles";
const SETTINGS_KEY = "knightly.settings";

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

export function getProfiles() {
  return readJson<UserProfile[]>(PROFILE_KEY, []);
}

export function saveProfiles(profiles: UserProfile[]) {
  writeJson(PROFILE_KEY, profiles);
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

export function saveGame(game: SavedGame) {
  const games = getSavedGames();
  writeJson(GAMES_KEY, [game, ...games.filter((item) => item.id !== game.id)]);
}

export function getSavedGame(id: string) {
  return getSavedGames().find((game) => game.id === id);
}

export function getPuzzleState() {
  return readJson<Record<string, PuzzleProgress>>(
    PUZZLES_KEY,
    {},
  );
}

export function setPuzzleState(
  state: Record<string, PuzzleProgress>,
) {
  writeJson(PUZZLES_KEY, state);
}

export function getSettings() {
  return readJson(
    SETTINGS_KEY,
    {
      boardStyle: "forest",
      pieceStyle: "classic",
      sounds: true,
    },
  );
}

export function setSettings(settings: {
  boardStyle: string;
  pieceStyle: string;
  sounds: boolean;
}) {
  writeJson(SETTINGS_KEY, settings);
}
