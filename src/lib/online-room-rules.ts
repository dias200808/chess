import type { SupabaseClient } from "@supabase/supabase-js";
import { Chess } from "chess.js";
import { START_FEN, getTimeControlPreset } from "@/lib/game-config";
import { getGameResult } from "@/lib/chess-utils";
import { saveFinishedRoomGame } from "@/lib/online-room-server";

type RoomRow = Record<string, unknown>;

export const START_CONNECT_WINDOW_MS = 15_000;
export const FIRST_MOVE_WINDOW_MS = 15_000;
export const DISCONNECT_FORFEIT_MS = 60_000;
export const EARLY_ABORT_MAX_PLIES = 4;
export const DRAW_REOFFER_COOLDOWN_PLIES = 10;

function replay(moves: string[]) {
  const chess = new Chess();
  for (const move of moves) {
    try {
      chess.move(move);
    } catch {
      break;
    }
  }
  return chess;
}

export function roomClockPatch(timeControlId: string) {
  const timeControl = getTimeControlPreset(timeControlId);
  const baseMs = timeControl.initialSeconds === null ? null : timeControl.initialSeconds * 1000;
  return {
    white_time_ms: baseMs,
    black_time_ms: baseMs,
    increment_seconds: timeControl.incrementSeconds,
  };
}

export function roomReadyLifecyclePatch(timeControlId: string, nowMs = Date.now()) {
  const readyAt = new Date(nowMs).toISOString();
  return {
    current_position: START_FEN,
    moves: [],
    status: "ready",
    result: "*",
    ready_at: readyAt,
    last_move_at: readyAt,
    connect_deadline_at: new Date(nowMs + START_CONNECT_WINDOW_MS).toISOString(),
    first_move_deadline_at: new Date(nowMs + FIRST_MOVE_WINDOW_MS).toISOString(),
    white_connected_at: null,
    black_connected_at: null,
    draw_offered_by: null,
    draw_offer_ply: null,
    white_draw_blocked_until_ply: null,
    black_draw_blocked_until_ply: null,
    rematch_requested_by: null,
    rematch_room_id: null,
    end_reason: null,
    ...roomClockPatch(timeControlId),
  };
}

export function roomMoves(room: RoomRow) {
  return Array.isArray(room.moves) ? (room.moves as string[]) : [];
}

export function roomPly(room: RoomRow) {
  return roomMoves(room).length;
}

function timestampMs(value: unknown) {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function finishResultForAbandonment(side: "white" | "black") {
  return side === "white" ? "0-1" : "1-0";
}

function isAbortReason(reason: string) {
  return reason.toLowerCase().startsWith("game aborted");
}

async function persistOutcome(
  supabase: SupabaseClient,
  room: RoomRow,
  {
    result,
    endReason,
    nowMs,
    skipRatingAndStats = false,
  }: {
    result: string;
    endReason: string;
    nowMs: number;
    skipRatingAndStats?: boolean;
  },
) {
  const moves = roomMoves(room);
  const chess = replay(moves);
  const patch = {
    status: "finished",
    result,
    end_reason: endReason,
    draw_offered_by: null,
    draw_offer_ply: null,
    connect_deadline_at: null,
    first_move_deadline_at: null,
    updated_at: new Date(nowMs).toISOString(),
  };

  const { data: updatedRoom, error } = await supabase.from("rooms").update(patch).eq("id", room.id).select("*").single();
  if (error) {
    throw error;
  }

  await saveFinishedRoomGame(room, {
    moves,
    fen: chess.fen(),
    result,
    endReason,
    skipRatingAndStats,
    ratedOverride: skipRatingAndStats ? false : undefined,
  });

  return updatedRoom as RoomRow;
}

export async function enforceRoomLifecycle(
  supabase: SupabaseClient,
  room: RoomRow,
  nowMs = Date.now(),
): Promise<{ room: RoomRow; changed: boolean }> {
  if (room.status !== "ready") return { room, changed: false };
  if (typeof room.result === "string" && room.result !== "*") return { room, changed: false };

  const moves = roomMoves(room);
  const connectDeadlineAt = timestampMs(room.connect_deadline_at);
  const firstMoveDeadlineAt = timestampMs(room.first_move_deadline_at);
  const whiteConnectedAt = timestampMs(room.white_connected_at);
  const blackConnectedAt = timestampMs(room.black_connected_at);

  if (!blackConnectedAt && connectDeadlineAt !== null && nowMs > connectDeadlineAt) {
    return {
      room: await persistOutcome(supabase, room, {
        result: "1/2-1/2",
        endReason: "Game aborted: opponent did not connect.",
        nowMs,
        skipRatingAndStats: true,
      }),
      changed: true,
    };
  }

  if (moves.length === 0 && firstMoveDeadlineAt !== null && nowMs > firstMoveDeadlineAt) {
    return {
      room: await persistOutcome(supabase, room, {
        result: "1/2-1/2",
        endReason: "Game aborted: White did not make the first move.",
        nowMs,
        skipRatingAndStats: true,
      }),
      changed: true,
    };
  }

  const whiteDisconnected = whiteConnectedAt !== null && nowMs - whiteConnectedAt > DISCONNECT_FORFEIT_MS;
  const blackDisconnected = blackConnectedAt !== null && nowMs - blackConnectedAt > DISCONNECT_FORFEIT_MS;

  if (!whiteDisconnected && !blackDisconnected) {
    return { room, changed: false };
  }

  if (whiteDisconnected && blackDisconnected) {
    const reason =
      moves.length < EARLY_ABORT_MAX_PLIES
        ? "Game aborted: both players disconnected before the game really started."
        : "Game aborted: both players disconnected.";
    return {
      room: await persistOutcome(supabase, room, {
        result: "1/2-1/2",
        endReason: reason,
        nowMs,
        skipRatingAndStats: true,
      }),
      changed: true,
    };
  }

  if (moves.length === 0) {
    const reason = whiteDisconnected
      ? "Game aborted: player left before the first move."
      : "Game aborted: opponent did not connect.";
    return {
      room: await persistOutcome(supabase, room, {
        result: "1/2-1/2",
        endReason: reason,
        nowMs,
        skipRatingAndStats: true,
      }),
      changed: true,
    };
  }

  if (moves.length < EARLY_ABORT_MAX_PLIES) {
    return {
      room: await persistOutcome(supabase, room, {
        result: "1/2-1/2",
        endReason: "Game aborted: early disconnect before two full moves.",
        nowMs,
        skipRatingAndStats: true,
      }),
      changed: true,
    };
  }

  const abandonedSide = whiteDisconnected ? "white" : "black";
  return {
    room: await persistOutcome(supabase, room, {
      result: finishResultForAbandonment(abandonedSide),
      endReason:
        abandonedSide === "white" ? "White lost: abandoned the game." : "Black lost: abandoned the game.",
      nowMs,
      skipRatingAndStats: false,
    }),
    changed: true,
  };
}

export function roomEndMessage(room: RoomRow) {
  const endReason = typeof room.end_reason === "string" ? room.end_reason : "";
  if (endReason) return endReason;

  const chess = replay(roomMoves(room));
  const gameResult = getGameResult(chess);
  return gameResult.label;
}

export function drawBlockedUntilPly(room: RoomRow, side: "white" | "black") {
  const key = side === "white" ? "white_draw_blocked_until_ply" : "black_draw_blocked_until_ply";
  const value = room[key];
  return typeof value === "number" ? value : value === null || value === undefined ? 0 : Number(value);
}

export function hasAbortReason(room: RoomRow) {
  return isAbortReason(typeof room.end_reason === "string" ? room.end_reason : "");
}
