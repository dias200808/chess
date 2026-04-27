import { NextResponse } from "next/server";
import { Chess } from "chess.js";
import { mapRoom } from "@/lib/supabase-data";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function sideForPlayer(room: Record<string, unknown>, playerKey: string) {
  if (room.host_key === playerKey) return "white";
  if (room.guest_key === playerKey) return "black";
  return null;
}

function replay(moves: string[]) {
  const chess = new Chess();
  for (const move of moves) chess.move(move);
  return chess;
}

async function saveFinishedGame(room: Record<string, unknown>, result: string, endReason: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;
  const moves = Array.isArray(room.moves) ? (room.moves as string[]) : [];
  const chess = replay(moves);
  await supabase.from("games").upsert(
    {
      id: room.id,
      white_user_id: null,
      black_user_id: null,
      white_player: "White",
      black_player: "Black",
      mode: "friend",
      result,
      winner: result === "1-0" ? "white" : result === "0-1" ? "black" : "draw",
      end_reason: endReason,
      opponent: "Online opponent",
      moves,
      pgn: chess.pgn(),
      final_position: chess.fen(),
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
      { error: "Room actions need SUPABASE_SERVICE_ROLE_KEY on Vercel." },
      { status: 500 },
    );
  }

  const { id } = await context.params;
  const body = (await request.json()) as {
    playerKey?: string;
    action?: "resign" | "offer_draw" | "accept_draw" | "decline_draw" | "cancel";
  };
  if (!body.playerKey || !body.action) {
    return NextResponse.json({ error: "Missing action payload." }, { status: 400 });
  }

  const { data: room, error } = await supabase.from("rooms").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const side = sideForPlayer(room, body.playerKey);
  if (!side) return NextResponse.json({ error: "Not a room player." }, { status: 403 });

  let patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let result: string | null = null;
  let endReason: string | null = null;

  if (body.action === "cancel") {
    if (room.status !== "waiting" || side !== "white") {
      return NextResponse.json({ error: "Only the waiting host can cancel search." }, { status: 409 });
    }
    patch = { ...patch, status: "finished", result: "1/2-1/2", end_reason: "Search cancelled" };
  }

  if (body.action === "resign") {
    result = side === "white" ? "0-1" : "1-0";
    endReason = `${side} resigned`;
    patch = { ...patch, status: "finished", result, end_reason: endReason };
  }

  if (body.action === "offer_draw") {
    if (room.status !== "ready") return NextResponse.json({ error: "Game is not active." }, { status: 409 });
    patch = { ...patch, draw_offered_by: side };
  }

  if (body.action === "decline_draw") {
    if (!room.draw_offered_by || room.draw_offered_by === side) {
      return NextResponse.json({ error: "No opponent draw offer to decline." }, { status: 409 });
    }
    patch = { ...patch, draw_offered_by: null };
  }

  if (body.action === "accept_draw") {
    if (!room.draw_offered_by || room.draw_offered_by === side) {
      return NextResponse.json({ error: "No opponent draw offer to accept." }, { status: 409 });
    }
    result = "1/2-1/2";
    endReason = "Draw agreement";
    patch = { ...patch, status: "finished", result, end_reason: endReason, draw_offered_by: null };
  }

  const { data: updatedRoom, error: updateError } = await supabase
    .from("rooms")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (result && endReason) await saveFinishedGame(room, result, endReason);
  return NextResponse.json({ room: mapRoom(updatedRoom) });
}
