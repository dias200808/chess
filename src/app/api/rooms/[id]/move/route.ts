import { NextResponse } from "next/server";
import { Chess } from "chess.js";
import { getGameResult } from "@/lib/chess-utils";
import { enforceRoomLifecycle } from "@/lib/online-room-rules";
import { sideForPlayer, saveFinishedRoomGame } from "@/lib/online-room-server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { mapRoom } from "@/lib/supabase-data";

function replay(moves: string[]) {
  const chess = new Chess();
  for (const move of moves) {
    chess.move(move);
  }
  return chess;
}

function resultForTimeout(side: "white" | "black") {
  return side === "white" ? "0-1" : "1-0";
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server move validation needs SUPABASE_SERVICE_ROLE_KEY on Vercel." },
      { status: 500 },
    );
  }

  const { id } = await context.params;
  const body = (await request.json()) as {
    playerKey?: string;
    from?: string;
    to?: string;
    promotion?: "q" | "r" | "b" | "n";
  };

  if (!body.playerKey || !body.from || !body.to) {
    return NextResponse.json({ error: "Missing move payload." }, { status: 400 });
  }

  const { data: room, error } = await supabase.from("rooms").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  const lifecycle = await enforceRoomLifecycle(supabase, room);
  const activeRoom = lifecycle.room;
  if (lifecycle.changed && (activeRoom.status !== "ready" || (activeRoom.result && activeRoom.result !== "*"))) {
    return NextResponse.json({ room: mapRoom(activeRoom) });
  }
  if (activeRoom.status !== "ready" || (activeRoom.result && activeRoom.result !== "*")) {
    return NextResponse.json({ error: "Game is not playable." }, { status: 409 });
  }

  const side = sideForPlayer(activeRoom, body.playerKey);
  if (!side) return NextResponse.json({ error: "You are not a player in this room." }, { status: 403 });

  const chess = replay(Array.isArray(activeRoom.moves) ? (activeRoom.moves as string[]) : []);
  const turnSide = chess.turn() === "w" ? "white" : "black";
  if (side !== turnSide) {
    return NextResponse.json({ error: "It is not your turn." }, { status: 409 });
  }

  const now = Date.now();
  const lastMoveAt =
    typeof activeRoom.last_move_at === "string" ? new Date(activeRoom.last_move_at).getTime() : now;
  const timed = typeof activeRoom.white_time_ms === "number" && typeof activeRoom.black_time_ms === "number";
  let whiteTimeMs = timed ? Number(activeRoom.white_time_ms) : null;
  let blackTimeMs = timed ? Number(activeRoom.black_time_ms) : null;

  if (timed) {
    const elapsed = Math.max(0, now - lastMoveAt);
    if (side === "white" && whiteTimeMs !== null) whiteTimeMs -= elapsed;
    if (side === "black" && blackTimeMs !== null) blackTimeMs -= elapsed;

    const remaining = side === "white" ? whiteTimeMs : blackTimeMs;
    if (remaining !== null && remaining <= 0) {
      const timeoutResult = resultForTimeout(side);
      const endReason = `Timeout: ${side} flagged`;
      const { data: updatedRoom } = await supabase
        .from("rooms")
        .update({
          status: "finished",
          result: timeoutResult,
          end_reason: endReason,
          white_time_ms: Math.max(0, whiteTimeMs ?? 0),
          black_time_ms: Math.max(0, blackTimeMs ?? 0),
          draw_offered_by: null,
          draw_offer_ply: null,
          updated_at: new Date(now).toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();
      await saveFinishedRoomGame(activeRoom, {
        moves: chess.history(),
        fen: chess.fen(),
        result: timeoutResult,
        endReason,
      });
      return NextResponse.json({ room: mapRoom(updatedRoom) });
    }
  }

  let move;
  try {
    move = chess.move({
      from: body.from,
      to: body.to,
      promotion: body.promotion ?? "q",
    });
  } catch {
    return NextResponse.json({ error: "Illegal move." }, { status: 400 });
  }

  if (!move) return NextResponse.json({ error: "Illegal move." }, { status: 400 });

  const incrementMs = Number(activeRoom.increment_seconds ?? 0) * 1000;
  if (timed) {
    if (side === "white" && whiteTimeMs !== null) whiteTimeMs += incrementMs;
    if (side === "black" && blackTimeMs !== null) blackTimeMs += incrementMs;
  }

  const nextMoves = chess.history();
  const gameResult = getGameResult(chess);
  const finished = gameResult.result !== "*";
  const endReason = finished ? gameResult.label : null;

  const { data: updatedRoom, error: updateError } = await supabase
    .from("rooms")
    .update({
      moves: nextMoves,
      current_position: chess.fen(),
      result: gameResult.result,
      status: finished ? "finished" : "ready",
      end_reason: endReason,
      white_time_ms: whiteTimeMs,
      black_time_ms: blackTimeMs,
      draw_offered_by: null,
      draw_offer_ply: null,
      last_move_at: new Date(now).toISOString(),
      connect_deadline_at: null,
      first_move_deadline_at: null,
      updated_at: new Date(now).toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (finished) {
    await saveFinishedRoomGame(activeRoom, {
      moves: nextMoves,
      fen: chess.fen(),
      result: gameResult.result,
      endReason: endReason ?? "Game over",
    });
  }
  return NextResponse.json({ room: mapRoom(updatedRoom) });
}
