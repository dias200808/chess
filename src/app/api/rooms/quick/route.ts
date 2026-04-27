import { NextResponse } from "next/server";
import { START_FEN, getTimeControlPreset } from "@/lib/game-config";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { mapRoom } from "@/lib/supabase-data";

function roomClock(timeControlId: string) {
  const timeControl = getTimeControlPreset(timeControlId);
  const baseMs = timeControl.initialSeconds === null ? null : timeControl.initialSeconds * 1000;
  return {
    white_time_ms: baseMs,
    black_time_ms: baseMs,
    increment_seconds: timeControl.incrementSeconds,
  };
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Quick online needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    timeControl?: string;
    playerKey?: string;
    rating?: number | null;
  };
  const playerKey = body.playerKey?.trim();
  const timeControl = getTimeControlPreset(body.timeControl ?? "10-0");
  const rating = Number.isFinite(body.rating) ? Number(body.rating) : null;

  if (!playerKey) {
    return NextResponse.json({ error: "Missing player key." }, { status: 400 });
  }

  const { data: waitingRooms, error: findError } = await supabase
    .from("rooms")
    .select("*")
    .eq("match_type", "quick")
    .eq("status", "waiting")
    .eq("time_control", timeControl.id)
    .neq("host_key", playerKey)
    .order("created_at", { ascending: true })
    .limit(25);

  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });

  const waitingRoom =
    (waitingRooms ?? []).find((room) => {
      if (!rating || room.host_rating === null || room.host_rating === undefined) return true;
      return Math.abs(Number(room.host_rating) - rating) <= 300;
    }) ??
    waitingRooms?.[0] ??
    null;

  if (waitingRoom) {
    const { data: joinedRoom, error: joinError } = await supabase
      .from("rooms")
      .update({
        status: "ready",
        guest_key: playerKey,
        guest_rating: rating,
        result: "*",
        last_move_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", waitingRoom.id)
      .eq("status", "waiting")
      .neq("host_key", playerKey)
      .select("*")
      .maybeSingle();

    if (joinError) return NextResponse.json({ error: joinError.message }, { status: 500 });
    if (joinedRoom) return NextResponse.json({ room: mapRoom(joinedRoom), side: "black" });
  }

  const { data: createdRoom, error: createError } = await supabase
    .from("rooms")
    .insert({
      white_user_id: null,
      black_user_id: null,
      current_position: START_FEN,
      moves: [],
      status: "waiting",
      result: "*",
      time_control: timeControl.id,
      match_type: "quick",
      host_key: playerKey,
      host_rating: rating,
      rated: Boolean(rating),
      ...roomClock(timeControl.id),
    })
    .select("*")
    .single();

  if (createError) return NextResponse.json({ error: createError.message }, { status: 500 });
  return NextResponse.json({ room: mapRoom(createdRoom), side: "white" });
}
