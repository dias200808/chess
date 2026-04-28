import { NextResponse } from "next/server";
import { getTimeControlPreset, isGuestOnlineTimeControl, START_FEN } from "@/lib/game-config";
import { roomClockPatch } from "@/lib/online-room-rules";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { mapRoom } from "@/lib/supabase-data";
import type { OnlineGameType, PlayerKind } from "@/lib/types";

function sanitizePlayerType(playerType?: string, userId?: string | null): PlayerKind {
  if (playerType === "account" && userId) return "account";
  return "guest";
}

function sanitizeGameType(gameType?: string, playerType?: PlayerKind): OnlineGameType {
  if (gameType === "rated" && playerType === "account") return "rated";
  return "casual";
}

function sanitizeName(username?: string | null, fallback = "Player") {
  const value = username?.trim();
  if (!value) return fallback;
  return value.slice(0, 24);
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Invite rooms need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    timeControl?: string;
    playerKey?: string;
    playerType?: PlayerKind;
    userId?: string | null;
    username?: string;
    gameType?: OnlineGameType;
    rating?: number | null;
  };

  const playerKey = body.playerKey?.trim();
  const timeControl = getTimeControlPreset(body.timeControl ?? "10-0");
  const playerType = sanitizePlayerType(body.playerType, body.userId);
  const gameType = sanitizeGameType(body.gameType, playerType);
  const rating = playerType === "account" && Number.isFinite(body.rating) ? Number(body.rating) : null;
  const username = sanitizeName(body.username, playerType === "account" ? "Player" : "Guest");

  if (!playerKey) {
    return NextResponse.json({ error: "Missing player key." }, { status: 400 });
  }

  if (timeControl.initialSeconds === null) {
    return NextResponse.json({ error: "Online invite games require a timed control." }, { status: 400 });
  }

  if (playerType === "guest" && !isGuestOnlineTimeControl(timeControl.id)) {
    return NextResponse.json(
      { error: "Guest invite games support only 3+0, 5+0, and 10+0." },
      { status: 400 },
    );
  }

  const { data: createdRoom, error: createError } = await supabase
    .from("rooms")
    .insert({
      white_user_id: playerType === "account" ? body.userId : null,
      black_user_id: null,
      white_player: username,
      black_player: "Waiting...",
      white_player_type: playerType,
      black_player_type: "guest",
      white_rating: rating,
      black_rating: null,
      current_position: START_FEN,
      moves: [],
      status: "waiting",
      result: "*",
      time_control: timeControl.id,
      match_type: "invite",
      game_type: gameType,
      host_key: playerKey,
      host_rating: rating,
      rated: gameType === "rated",
      ...roomClockPatch(timeControl.id),
    })
    .select("*")
    .single();

  if (createError) return NextResponse.json({ error: createError.message }, { status: 500 });
  return NextResponse.json({ room: mapRoom(createdRoom), side: "white" });
}
