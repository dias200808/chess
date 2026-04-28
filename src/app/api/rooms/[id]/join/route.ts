import { NextResponse } from "next/server";
import { enforceRoomLifecycle, roomReadyLifecyclePatch } from "@/lib/online-room-rules";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { mapRoom } from "@/lib/supabase-data";
import type { PlayerKind } from "@/lib/types";

function sanitizePlayerType(playerType?: string, userId?: string | null): PlayerKind {
  if (playerType === "account" && userId) return "account";
  return "guest";
}

function sanitizeName(username?: string | null, fallback = "Player") {
  const value = username?.trim();
  if (!value) return fallback;
  return value.slice(0, 24);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Joining a room needs SUPABASE_SERVICE_ROLE_KEY on Vercel." },
      { status: 500 },
    );
  }

  const { id } = await context.params;
  const body = (await request.json()) as {
    playerKey?: string;
    playerType?: PlayerKind;
    userId?: string | null;
    username?: string;
    rating?: number | null;
  };

  const playerKey = body.playerKey?.trim();
  const playerType = sanitizePlayerType(body.playerType, body.userId);
  const username = sanitizeName(body.username, playerType === "account" ? "Player" : "Guest");
  const rating = playerType === "account" && Number.isFinite(body.rating) ? Number(body.rating) : null;

  if (!playerKey) return NextResponse.json({ error: "Missing player key." }, { status: 400 });

  const { data: room, error } = await supabase.from("rooms").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  const lifecycle = await enforceRoomLifecycle(supabase, room);
  const activeRoom = lifecycle.room;
  if (lifecycle.changed) {
    return NextResponse.json({ room: mapRoom(activeRoom) });
  }
  if (activeRoom.status !== "waiting") {
    return NextResponse.json({ error: "This room is no longer waiting for a second player." }, { status: 409 });
  }

  if (activeRoom.host_key === playerKey) {
    return NextResponse.json({ room: mapRoom(activeRoom), side: "white" });
  }

  if (activeRoom.game_type === "rated" && playerType !== "account") {
    return NextResponse.json(
      { error: "Rated invite games require two logged-in accounts." },
      { status: 403 },
    );
  }

  const nowMs = Date.now();
  const { data: joinedRoom, error: joinError } = await supabase
    .from("rooms")
    .update({
      black_user_id: playerType === "account" ? body.userId : null,
      black_player: username,
      black_player_type: playerType,
      black_rating: rating,
      guest_key: playerKey,
      guest_rating: rating,
      ...roomReadyLifecyclePatch(String(activeRoom.time_control ?? "10-0"), nowMs),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "waiting")
    .select("*")
    .maybeSingle();

  if (joinError) return NextResponse.json({ error: joinError.message }, { status: 500 });
  if (!joinedRoom) {
    return NextResponse.json({ error: "This room was joined from another tab." }, { status: 409 });
  }
  return NextResponse.json({ room: mapRoom(joinedRoom), side: "black" });
}
