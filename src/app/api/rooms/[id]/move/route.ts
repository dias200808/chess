import { NextResponse } from "next/server";
import { Chess } from "chess.js";
import { getGameResult } from "@/lib/chess-utils";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { mapRoom } from "@/lib/supabase-data";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function replay(moves: string[]) {
  const chess = new Chess();
  for (const move of moves) {
    chess.move(move);
  }
  return chess;
}

function sideForPlayer(room: Record<string, unknown>, playerKey: string) {
  if (room.host_key === playerKey) return "white";
  if (room.guest_key === playerKey) return "black";
  return null;
}

function resultForTimeout(side: "white" | "black") {
  return side === "white" ? "0-1" : "1-0";
}

async function saveFinishedGame(room: Record<string, unknown>, moves: string[], fen: string, result: string, endReason: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;
  const chess = replay(moves);
  await supabase.from("games").upsert(
    {
      id: room.id,
      white_user_id: null,
      black_user_id: null,
      white_player: room.host_key ? "White" : "White",
      black_player: room.guest_key ? "Black" : "Black",
      mode: "friend",
      result,
      winner: result === "1-0" ? "white" : result === "0-1" ? "black" : "draw",
      end_reason: endReason,
      opponent: "Online opponent",
      moves,
      pgn: chess.pgn(),
      final_position: fen || START_FEN,
      time_control: room.time_control ?? null,
      rated: false,
      white_accuracy: 0,
      black_accuracy: 0,
      analysis: null,
    },
    { onConflict: "id" },
  );
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
  if (room.status !== "ready" || (room.result && room.result !== "*")) {
    return NextResponse.json({ error: "Game is not playable.", room }, { status: 409 });
  }

  const side = sideForPlayer(room, body.playerKey);
  if (!side) return NextResponse.json({ error: "You are not a player in this room." }, { status: 403 });

  const chess = replay(Array.isArray(room.moves) ? room.moves : []);
  const turnSide = chess.turn() === "w" ? "white" : "black";
  if (side !== turnSide) {
    return NextResponse.json({ error: "It is not your turn." }, { status: 409 });
  }

  const now = Date.now();
  const lastMoveAt = room.last_move_at ? new Date(room.last_move_at).getTime() : now;
  const timed = typeof room.white_time_ms === "number" && typeof room.black_time_ms === "number";
  const whiteTimeBefore = timed ? Number(room.white_time_ms) : null;
  const blackTimeBefore = timed ? Number(room.black_time_ms) : null;
  let whiteTimeMs = whiteTimeBefore;
  let blackTimeMs = blackTimeBefore;

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
          updated_at: new Date(now).toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();
      await saveFinishedGame(room, chess.history(), chess.fen(), timeoutResult, endReason);
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

  const incrementMs = Number(room.increment_seconds ?? 0) * 1000;
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
      last_move_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (finished) await saveFinishedGame(room, nextMoves, chess.fen(), gameResult.result, endReason ?? "Game over");
  return NextResponse.json({ room: mapRoom(updatedRoom) });
}
