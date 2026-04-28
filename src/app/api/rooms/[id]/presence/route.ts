import { NextResponse } from "next/server";
import { enforceRoomLifecycle } from "@/lib/online-room-rules";
import { mapRoom } from "@/lib/supabase-data";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function sideForPlayer(room: Record<string, unknown>, playerKey: string) {
  if (room.host_key === playerKey) return "white";
  if (room.guest_key === playerKey) return "black";
  return null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Presence needs SUPABASE_SERVICE_ROLE_KEY on Vercel." },
      { status: 500 },
    );
  }

  const { id } = await context.params;
  const body = (await request.json()) as { playerKey?: string };
  if (!body.playerKey) return NextResponse.json({ error: "Missing player key." }, { status: 400 });

  const { data: room, error } = await supabase.from("rooms").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  const lifecycle = await enforceRoomLifecycle(supabase, room);
  const activeRoom = lifecycle.room;
  if (lifecycle.changed && activeRoom.status !== "ready") {
    return NextResponse.json({ room: mapRoom(activeRoom) });
  }

  const side = sideForPlayer(activeRoom, body.playerKey);
  if (!side) return NextResponse.json({ error: "Not a room player." }, { status: 403 });

  const nowIso = new Date().toISOString();
  const patch =
    side === "white"
      ? { white_connected_at: nowIso, updated_at: nowIso }
      : { black_connected_at: nowIso, updated_at: nowIso };
  const { data: updatedRoom, error: updateError } = await supabase
    .from("rooms")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ room: mapRoom(updatedRoom) });
}
