import type { SupabaseClient } from "@supabase/supabase-js";
import { Chess } from "chess.js";
import { getTimeControlPreset, START_FEN } from "@/lib/game-config";
import { calculateRatingChange, ratingTypeForTimeControl } from "@/lib/rating";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type RoomRow = Record<string, unknown>;

type RatingSummary = {
  whiteRatingBefore?: number;
  whiteRatingAfter?: number;
  whiteRatingChange?: number;
  blackRatingBefore?: number;
  blackRatingAfter?: number;
  blackRatingChange?: number;
  ratingType?: string | null;
};

function replay(moves: string[]) {
  const chess = new Chess();
  for (const move of moves) {
    chess.move(move);
  }
  return chess;
}

function winnerForResult(result: string) {
  if (result === "1-0") return "white";
  if (result === "0-1") return "black";
  if (result === "1/2-1/2") return "draw";
  return null;
}

function profileColumn(type: string) {
  switch (type) {
    case "bullet":
      return "bullet_rating";
    case "blitz":
      return "blitz_rating";
    case "rapid":
      return "rapid_rating";
    case "classical":
      return "classical_rating";
    default:
      return "rating";
  }
}

function profileRating(row: Record<string, unknown>, type: string) {
  const column = profileColumn(type);
  const value = row[column];
  if (typeof value === "number") return value;
  if (typeof row.rating === "number") return Number(row.rating);
  return 1200;
}

function outcomeScore(result: string, side: "white" | "black"): 0 | 0.5 | 1 {
  if (result === "1/2-1/2") return 0.5;
  if (result === "1-0") return side === "white" ? 1 : 0;
  if (result === "0-1") return side === "black" ? 1 : 0;
  return 0.5;
}

function statsPatch(row: Record<string, unknown>, result: string, side: "white" | "black") {
  const winner = winnerForResult(result);
  return {
    games_count: Number(row.games_count ?? 0) + 1,
    wins: Number(row.wins ?? 0) + (winner === side ? 1 : 0),
    losses: Number(row.losses ?? 0) + (winner && winner !== "draw" && winner !== side ? 1 : 0),
    draws: Number(row.draws ?? 0) + (winner === "draw" ? 1 : 0),
  };
}

async function applyRatedUpdates(
  supabase: SupabaseClient,
  room: RoomRow,
  result: string,
): Promise<RatingSummary> {
  const whiteUserId = typeof room.white_user_id === "string" ? room.white_user_id : null;
  const blackUserId = typeof room.black_user_id === "string" ? room.black_user_id : null;
  const timeControlId = typeof room.time_control === "string" ? room.time_control : "10-0";
  const ratingType = ratingTypeForTimeControl(getTimeControlPreset(timeControlId));

  if (room.game_type !== "rated" || !whiteUserId || !blackUserId || !ratingType) {
    return { ratingType };
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("*")
    .in("id", [whiteUserId, blackUserId]);

  if (error || !profiles || profiles.length < 2) {
    return { ratingType };
  }

  const whiteProfile = profiles.find((item) => item.id === whiteUserId);
  const blackProfile = profiles.find((item) => item.id === blackUserId);
  if (!whiteProfile || !blackProfile) {
    return { ratingType };
  }

  const whiteBefore = profileRating(whiteProfile, ratingType);
  const blackBefore = profileRating(blackProfile, ratingType);
  const whiteChange = calculateRatingChange({
    playerRating: whiteBefore,
    opponentRating: blackBefore,
    score: outcomeScore(result, "white"),
  });
  const blackChange = calculateRatingChange({
    playerRating: blackBefore,
    opponentRating: whiteBefore,
    score: outcomeScore(result, "black"),
  });
  const whiteAfter = whiteBefore + whiteChange;
  const blackAfter = blackBefore + blackChange;
  const column = profileColumn(ratingType);

  await Promise.all([
    supabase
      .from("profiles")
      .update({
        ...statsPatch(whiteProfile, result, "white"),
        rating: whiteAfter,
        [column]: whiteAfter,
      })
      .eq("id", whiteUserId),
    supabase
      .from("profiles")
      .update({
        ...statsPatch(blackProfile, result, "black"),
        rating: blackAfter,
        [column]: blackAfter,
      })
      .eq("id", blackUserId),
  ]);

  return {
    whiteRatingBefore: whiteBefore,
    whiteRatingAfter: whiteAfter,
    whiteRatingChange: whiteChange,
    blackRatingBefore: blackBefore,
    blackRatingAfter: blackAfter,
    blackRatingChange: blackChange,
    ratingType,
  };
}

async function applyCasualStats(supabase: SupabaseClient, room: RoomRow, result: string) {
  const updates: Promise<unknown>[] = [];

  for (const [side, userIdField] of [
    ["white", "white_user_id"],
    ["black", "black_user_id"],
  ] as const) {
    const userId = room[userIdField];
    if (typeof userId !== "string") continue;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) continue;
    updates.push(
      (async () => {
        await supabase
          .from("profiles")
          .update(statsPatch(profile, result, side))
          .eq("id", userId);
      })(),
    );
  }

  if (updates.length) await Promise.all(updates);
}

export function sideForPlayer(room: RoomRow, playerKey: string) {
  if (room.host_key === playerKey) return "white";
  if (room.guest_key === playerKey) return "black";
  return null;
}

export async function saveFinishedRoomGame(
  room: RoomRow,
  {
    moves = Array.isArray(room.moves) ? (room.moves as string[]) : [],
    fen,
    result,
    endReason,
    skipRatingAndStats = false,
    ratedOverride,
  }: {
    moves?: string[];
    fen?: string;
    result: string;
    endReason: string;
    skipRatingAndStats?: boolean;
    ratedOverride?: boolean;
  },
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const chess = replay(moves);
  const finalFen = fen || chess.fen() || START_FEN;
  const winner = winnerForResult(result);
  const rated = typeof ratedOverride === "boolean" ? ratedOverride : room.game_type === "rated";
  const ratingSummary = skipRatingAndStats
    ? { ratingType: null }
    : rated
      ? await applyRatedUpdates(supabase, room, result)
      : (await applyCasualStats(supabase, room, result), { ratingType: null });

  await supabase.from("games").upsert(
    {
      id: room.id,
      white_user_id: room.white_user_id ?? null,
      black_user_id: room.black_user_id ?? null,
      white_guest_key: room.host_key ?? null,
      black_guest_key: room.guest_key ?? null,
      white_player: room.white_player ?? "White",
      black_player: room.black_player ?? "Black",
      mode: room.match_type === "quick" ? "online" : "friend",
      match_type: room.match_type ?? null,
      result,
      winner,
      end_reason: endReason,
      opponent: "Online opponent",
      moves,
      pgn: chess.pgn(),
      final_position: finalFen,
      time_control: room.time_control ?? null,
      game_type: room.game_type ?? "casual",
      rated,
      rating_type: ratingSummary.ratingType,
      white_rating_before: ratingSummary.whiteRatingBefore ?? null,
      white_rating_after: ratingSummary.whiteRatingAfter ?? null,
      white_rating_change: ratingSummary.whiteRatingChange ?? null,
      black_rating_before: ratingSummary.blackRatingBefore ?? null,
      black_rating_after: ratingSummary.blackRatingAfter ?? null,
      black_rating_change: ratingSummary.blackRatingChange ?? null,
      rating_before: ratingSummary.whiteRatingBefore ?? null,
      rating_after: ratingSummary.whiteRatingAfter ?? null,
      rating_change: ratingSummary.whiteRatingChange ?? null,
      white_accuracy: 0,
      black_accuracy: 0,
      analysis: null,
    },
    { onConflict: "id" },
  );
}
