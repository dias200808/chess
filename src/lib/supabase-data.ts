import type { RealtimeChannel } from "@supabase/supabase-js";
import type { GameAnalysis, GameMode, GameResult, PuzzleProgress, Room, SavedGame, UserProfile } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase";

function avatarFor(username: string) {
  return username
    .split(/\s|_/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "K";
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseClient());
}

export function mapProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    email: String(row.email ?? ""),
    username: String(row.username ?? "Player"),
    city: String(row.city ?? "Unknown"),
    avatar: String(row.avatar ?? avatarFor(String(row.username ?? "Player"))),
    rating: Number(row.rating ?? 1200),
    gamesCount: Number(row.games_count ?? 0),
    wins: Number(row.wins ?? 0),
    losses: Number(row.losses ?? 0),
    draws: Number(row.draws ?? 0),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function profileToRow(profile: Partial<UserProfile>) {
  return {
    id: profile.id,
    email: profile.email,
    username: profile.username,
    city: profile.city,
    avatar: profile.avatar ?? (profile.username ? avatarFor(profile.username) : undefined),
    rating: profile.rating,
    games_count: profile.gamesCount,
    wins: profile.wins,
    losses: profile.losses,
    draws: profile.draws,
  };
}

export async function fetchProfilesFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("profiles").select("*").order("rating", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapProfile(row));
}

export async function fetchProfileFromSupabase(userId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data) : null;
}

export async function upsertProfileToSupabase(profile: Partial<UserProfile>) {
  const supabase = getSupabaseClient();
  if (!supabase || !profile.id) return null;
  const { data, error } = await supabase
    .from("profiles")
    .upsert(profileToRow(profile), { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  return mapProfile(data);
}

export function mapGame(row: Record<string, unknown>): SavedGame {
  return {
    id: String(row.id),
    whiteUserId: row.white_user_id ? String(row.white_user_id) : undefined,
    blackUserId: row.black_user_id ? String(row.black_user_id) : undefined,
    mode: String(row.mode ?? "local") as GameMode,
    result: String(row.result ?? "*") as GameResult,
    winner: (row.winner as SavedGame["winner"]) ?? null,
    opponent: String(row.opponent ?? "Opponent"),
    moves: Array.isArray(row.moves) ? (row.moves as string[]) : [],
    pgn: String(row.pgn ?? ""),
    finalPosition: String(row.final_position ?? ""),
    whiteAccuracy: Number(row.white_accuracy ?? 0),
    blackAccuracy: Number(row.black_accuracy ?? 0),
    analysis: (row.analysis as GameAnalysis) ?? {
      summary: "No analysis saved yet.",
      whiteAccuracy: 0,
      blackAccuracy: 0,
      evaluations: [],
      trainingFocus: "Analyze the game to generate training focus.",
    },
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function saveGameToSupabase(game: SavedGame) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("games")
    .upsert(
      {
        id: game.id,
        white_user_id: game.whiteUserId ?? null,
        black_user_id: game.blackUserId ?? null,
        mode: game.mode,
        result: game.result,
        winner: game.winner,
        opponent: game.opponent,
        moves: game.moves,
        pgn: game.pgn,
        final_position: game.finalPosition,
        white_accuracy: game.whiteAccuracy,
        black_accuracy: game.blackAccuracy,
        analysis: game.analysis,
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return mapGame(data);
}

export async function fetchGamesFromSupabase(userId?: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  let query = supabase.from("games").select("*").order("created_at", { ascending: false });
  if (userId) query = query.or(`white_user_id.eq.${userId},black_user_id.eq.${userId}`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapGame(row));
}

export async function fetchGameFromSupabase(id: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapGame(data) : null;
}

export async function upsertPuzzleProgressToSupabase(
  userId: string,
  puzzleId: string,
  progress: PuzzleProgress,
) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { error } = await supabase.from("puzzle_progress").upsert(
    {
      user_id: userId,
      puzzle_id: puzzleId,
      solved: progress.solved,
      attempts: progress.attempts,
      score: progress.score,
      best_rush_score: progress.bestRushScore,
      current_streak: progress.currentStreak,
      best_streak: progress.bestStreak,
      puzzle_rating: progress.puzzleRating,
      best_puzzle_rating: progress.bestPuzzleRating,
      last_solved_at: progress.lastSolvedAt ?? null,
    },
    { onConflict: "user_id,puzzle_id" },
  );
  if (error) throw error;
  return progress;
}

export async function fetchPuzzleProgressFromSupabase(userId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("puzzle_progress").select("*").eq("user_id", userId);
  if (error) throw error;
  return Object.fromEntries(
    (data ?? []).map((row) => [
      String(row.puzzle_id),
      {
        solved: Boolean(row.solved),
        attempts: Number(row.attempts ?? 0),
        score: Number(row.score ?? 0),
        bestRushScore: Number(row.best_rush_score ?? 0),
        currentStreak: Number(row.current_streak ?? 0),
        bestStreak: Number(row.best_streak ?? 0),
        puzzleRating: Number(row.puzzle_rating ?? 800),
        bestPuzzleRating: Number(row.best_puzzle_rating ?? 800),
        lastSolvedAt: row.last_solved_at ? String(row.last_solved_at) : undefined,
      } satisfies PuzzleProgress,
    ]),
  );
}

export async function createRoomInSupabase(userId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("rooms")
    .insert({ white_user_id: userId, current_position: "start", moves: [], status: "waiting" })
    .select("*")
    .single();
  if (error) throw error;
  return mapRoom(data);
}

export async function joinRoomInSupabase(roomId: string, userId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const room = await fetchRoomFromSupabase(roomId);
  if (!room) return null;
  const patch = room.blackUserId || room.whiteUserId === userId
    ? { status: "ready" }
    : { black_user_id: userId, status: "ready" };
  const { data, error } = await supabase.from("rooms").update(patch).eq("id", roomId).select("*").single();
  if (error) throw error;
  return mapRoom(data);
}

export async function fetchRoomFromSupabase(roomId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (error) throw error;
  return data ? mapRoom(data) : null;
}

export async function updateRoomMovesInSupabase(roomId: string, moves: string[], fen: string, result = "*") {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("rooms")
    .update({
      moves,
      current_position: fen,
      result,
      status: result === "*" ? "ready" : "finished",
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .select("*")
    .single();
  if (error) throw error;
  return mapRoom(data);
}

export function subscribeToRoom(roomId: string, onChange: (room: Room) => void): RealtimeChannel | null {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
      (payload) => onChange(mapRoom(payload.new as Record<string, unknown>)),
    )
    .subscribe();
  return channel;
}

export function mapRoom(row: Record<string, unknown>): Room {
  return {
    id: String(row.id),
    link: typeof window === "undefined" ? "" : `${window.location.origin}/friend?room=${row.id}`,
    whiteUserId: row.white_user_id ? String(row.white_user_id) : undefined,
    blackUserId: row.black_user_id ? String(row.black_user_id) : undefined,
    currentPosition: String(row.current_position ?? "start"),
    moves: Array.isArray(row.moves) ? (row.moves as string[]) : [],
    status: String(row.status ?? "waiting") as Room["status"],
    result: row.result ? String(row.result) : undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}
