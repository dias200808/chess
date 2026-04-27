import type { RealtimeChannel } from "@supabase/supabase-js";
import type { GameAnalysis, GameMode, GameResult, PuzzleProgress, Room, SavedGame, UserProfile } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase";
import { getTimeControlPreset } from "@/lib/game-config";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function roomClock(timeControlId: string) {
  const timeControl = getTimeControlPreset(timeControlId);
  const baseMs = timeControl.initialSeconds === null ? null : timeControl.initialSeconds * 1000;
  return {
    white_time_ms: baseMs,
    black_time_ms: baseMs,
    increment_seconds: timeControl.incrementSeconds,
  };
}

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
    country: String(row.country ?? "Unknown"),
    avatar: String(row.avatar ?? avatarFor(String(row.username ?? "Player"))),
    rating: Number(row.rating ?? 1200),
    bulletRating: Number(row.bullet_rating ?? row.rating ?? 1200),
    blitzRating: Number(row.blitz_rating ?? row.rating ?? 1200),
    rapidRating: Number(row.rapid_rating ?? row.rating ?? 1200),
    classicalRating: Number(row.classical_rating ?? row.rating ?? 1200),
    puzzleRating: Number(row.puzzle_rating ?? 1200),
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
    country: profile.country,
    avatar: profile.avatar ?? (profile.username ? avatarFor(profile.username) : undefined),
    rating: profile.rating,
    bullet_rating: profile.bulletRating,
    blitz_rating: profile.blitzRating,
    rapid_rating: profile.rapidRating,
    classical_rating: profile.classicalRating,
    puzzle_rating: profile.puzzleRating,
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
    whitePlayer: String(row.white_player ?? "White"),
    blackPlayer: String(row.black_player ?? "Black"),
    mode: String(row.mode ?? "local") as GameMode,
    result: String(row.result ?? "*") as GameResult,
    winner: (row.winner as SavedGame["winner"]) ?? null,
    endReason: String(row.end_reason ?? "Unknown"),
    opponent: String(row.opponent ?? "Opponent"),
    moves: Array.isArray(row.moves) ? (row.moves as string[]) : [],
    pgn: String(row.pgn ?? ""),
    finalPosition: String(row.final_position ?? ""),
    timeControl: row.time_control ? String(row.time_control) : undefined,
    rated: Boolean(row.rated ?? false),
    ratingType: row.rating_type ? (String(row.rating_type) as SavedGame["ratingType"]) : undefined,
    ratingBefore: row.rating_before === null || row.rating_before === undefined ? undefined : Number(row.rating_before),
    ratingAfter: row.rating_after === null || row.rating_after === undefined ? undefined : Number(row.rating_after),
    ratingChange: row.rating_change === null || row.rating_change === undefined ? undefined : Number(row.rating_change),
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
        white_player: game.whitePlayer,
        black_player: game.blackPlayer,
        mode: game.mode,
        result: game.result,
        winner: game.winner,
        end_reason: game.endReason,
        opponent: game.opponent,
        moves: game.moves,
        pgn: game.pgn,
        final_position: game.finalPosition,
        time_control: game.timeControl ?? null,
        rated: game.rated ?? false,
        rating_type: game.ratingType ?? null,
        rating_before: game.ratingBefore ?? null,
        rating_after: game.ratingAfter ?? null,
        rating_change: game.ratingChange ?? null,
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
    .insert({ white_user_id: userId, current_position: START_FEN, moves: [], status: "waiting" })
    .select("*")
    .single();
  if (error) throw error;
  return mapRoom(data);
}

export async function createGuestRoomInSupabase(timeControl = "10-0", hostKey?: string, hostRating?: number | null) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("rooms")
    .insert({
      white_user_id: null,
      black_user_id: null,
      current_position: START_FEN,
      moves: [],
      status: "waiting",
      result: "*",
      time_control: timeControl,
      match_type: "invite",
      host_key: hostKey ?? null,
      host_rating: hostRating ?? null,
      rated: false,
      ...roomClock(timeControl),
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapRoom(data);
}

export async function findWaitingQuickRoom({
  timeControl,
  playerKey,
  rating,
}: {
  timeControl: string;
  playerKey: string;
  rating?: number | null;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("match_type", "quick")
    .eq("status", "waiting")
    .eq("time_control", timeControl)
    .neq("host_key", playerKey)
    .order("created_at", { ascending: true })
    .limit(25);
  if (error) throw error;
  const rooms = (data ?? []).map((row) => mapRoom(row));
  if (!rating) return rooms[0] ?? null;
  return (
    rooms.find((room) => !room.hostRating || Math.abs(room.hostRating - rating) <= 300) ??
    rooms[0] ??
    null
  );
}

export async function createQuickMatchRoom({
  timeControl,
  playerKey,
  rating,
}: {
  timeControl: string;
  playerKey: string;
  rating?: number | null;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("rooms")
    .insert({
      white_user_id: null,
      black_user_id: null,
      current_position: START_FEN,
      moves: [],
      status: "waiting",
      result: "*",
      time_control: timeControl,
      match_type: "quick",
      host_key: playerKey,
      host_rating: rating ?? null,
      rated: Boolean(rating),
      ...roomClock(timeControl),
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapRoom(data);
}

export async function joinQuickMatchRoom({
  roomId,
  playerKey,
  rating,
}: {
  roomId: string;
  playerKey: string;
  rating?: number | null;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("rooms")
    .update({
      status: "ready",
      guest_key: playerKey,
      guest_rating: rating ?? null,
      result: "*",
      last_move_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .eq("status", "waiting")
    .neq("host_key", playerKey)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? mapRoom(data) : null;
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

export async function joinGuestRoomInSupabase(roomId: string, guestKey?: string, guestRating?: number | null) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("rooms")
    .update({
      status: "ready",
      guest_key: guestKey ?? null,
      guest_rating: guestRating ?? null,
      result: "*",
      last_move_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .eq("status", "waiting")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? mapRoom(data) : null;
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
    currentPosition: String(row.current_position ?? START_FEN),
    moves: Array.isArray(row.moves) ? (row.moves as string[]) : [],
    status: String(row.status ?? "waiting") as Room["status"],
    result: row.result ? String(row.result) : undefined,
    timeControl: row.time_control ? String(row.time_control) : undefined,
    matchType: String(row.match_type ?? "invite") as Room["matchType"],
    hostKey: row.host_key ? String(row.host_key) : undefined,
    guestKey: row.guest_key ? String(row.guest_key) : undefined,
    hostRating: row.host_rating === null || row.host_rating === undefined ? undefined : Number(row.host_rating),
    guestRating: row.guest_rating === null || row.guest_rating === undefined ? undefined : Number(row.guest_rating),
    whiteTimeMs: row.white_time_ms === null || row.white_time_ms === undefined ? undefined : Number(row.white_time_ms),
    blackTimeMs: row.black_time_ms === null || row.black_time_ms === undefined ? undefined : Number(row.black_time_ms),
    incrementSeconds: Number(row.increment_seconds ?? 0),
    lastMoveAt: row.last_move_at ? String(row.last_move_at) : undefined,
    whiteConnectedAt: row.white_connected_at ? String(row.white_connected_at) : undefined,
    blackConnectedAt: row.black_connected_at ? String(row.black_connected_at) : undefined,
    drawOfferedBy: row.draw_offered_by ? (String(row.draw_offered_by) as Room["drawOfferedBy"]) : undefined,
    endReason: row.end_reason ? String(row.end_reason) : undefined,
    rated: Boolean(row.rated ?? false),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}
