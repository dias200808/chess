import { NextResponse } from "next/server";
import {
  DRAW_REOFFER_COOLDOWN_PLIES,
  drawBlockedUntilPly,
  enforceRoomLifecycle,
  roomPly,
  roomReadyLifecyclePatch,
} from "@/lib/online-room-rules";
import { sideForPlayer, saveFinishedRoomGame } from "@/lib/online-room-server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { mapRoom } from "@/lib/supabase-data";

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
    action?:
      | "resign"
      | "offer_draw"
      | "accept_draw"
      | "decline_draw"
      | "cancel"
      | "request_rematch"
      | "accept_rematch";
  };
  if (!body.playerKey || !body.action) {
    return NextResponse.json({ error: "Missing action payload." }, { status: 400 });
  }

  const { data: room, error } = await supabase.from("rooms").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  const lifecycle = await enforceRoomLifecycle(supabase, room);
  const activeRoom = lifecycle.room;
  if (lifecycle.changed && body.action !== "request_rematch" && body.action !== "accept_rematch") {
    return NextResponse.json({ room: mapRoom(activeRoom) });
  }

  const side = sideForPlayer(activeRoom, body.playerKey);
  if (!side) return NextResponse.json({ error: "Not a room player." }, { status: 403 });

  if (body.action === "request_rematch") {
    if (activeRoom.status !== "finished") {
      return NextResponse.json({ error: "Rematch is available only after the game ends." }, { status: 409 });
    }

    const { data: updatedRoom, error: updateError } = await supabase
      .from("rooms")
      .update({
        rematch_requested_by: side,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ room: mapRoom(updatedRoom) });
  }

  if (body.action === "accept_rematch") {
    if (activeRoom.status !== "finished" || !activeRoom.rematch_requested_by || activeRoom.rematch_requested_by === side) {
      return NextResponse.json({ error: "No opponent rematch request to accept." }, { status: 409 });
    }

    const whiteFromBlack = activeRoom.guest_key && activeRoom.black_player;
    const nowMs = Date.now();
    const { data: newRoom, error: createError } = await supabase
      .from("rooms")
      .insert({
        white_user_id: whiteFromBlack ? activeRoom.black_user_id ?? null : activeRoom.white_user_id ?? null,
        black_user_id: whiteFromBlack ? activeRoom.white_user_id ?? null : activeRoom.black_user_id ?? null,
        white_player: whiteFromBlack ? activeRoom.black_player ?? "Black" : activeRoom.white_player ?? "White",
        black_player: whiteFromBlack ? activeRoom.white_player ?? "White" : activeRoom.black_player ?? "Black",
        white_player_type: whiteFromBlack ? activeRoom.black_player_type ?? "guest" : activeRoom.white_player_type ?? "guest",
        black_player_type: whiteFromBlack ? activeRoom.white_player_type ?? "guest" : activeRoom.black_player_type ?? "guest",
        white_rating: whiteFromBlack ? activeRoom.black_rating ?? null : activeRoom.white_rating ?? null,
        black_rating: whiteFromBlack ? activeRoom.white_rating ?? null : activeRoom.black_rating ?? null,
        time_control: activeRoom.time_control ?? "10-0",
        match_type: activeRoom.match_type ?? "invite",
        game_type: activeRoom.game_type ?? "casual",
        host_key: whiteFromBlack ? activeRoom.guest_key : activeRoom.host_key,
        guest_key: whiteFromBlack ? activeRoom.host_key : activeRoom.guest_key,
        host_rating: whiteFromBlack ? activeRoom.guest_rating ?? null : activeRoom.host_rating ?? null,
        guest_rating: whiteFromBlack ? activeRoom.host_rating ?? null : activeRoom.guest_rating ?? null,
        rated: Boolean(activeRoom.rated),
        ...roomReadyLifecyclePatch(String(activeRoom.time_control ?? "10-0"), nowMs),
        })
      .select("*")
      .single();

    if (createError) return NextResponse.json({ error: createError.message }, { status: 500 });

    await supabase
      .from("rooms")
      .update({
        rematch_room_id: newRoom.id,
        rematch_requested_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({ room: mapRoom(newRoom), rematchRoomId: newRoom.id });
  }

  let patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let result: string | null = null;
  let endReason: string | null = null;
  const currentPly = roomPly(activeRoom);

  if (body.action === "cancel") {
    if (activeRoom.status !== "waiting" || side !== "white") {
      return NextResponse.json({ error: "Only the waiting host can cancel search." }, { status: 409 });
    }
    patch = { ...patch, status: "finished", result: "1/2-1/2", end_reason: "Search cancelled" };
  }

  if (body.action === "resign") {
    if (activeRoom.status !== "ready") {
      return NextResponse.json({ error: "Game is not active." }, { status: 409 });
    }
    result = side === "white" ? "0-1" : "1-0";
    endReason = `${side} resigned`;
    patch = { ...patch, status: "finished", result, end_reason: endReason, draw_offered_by: null };
  }

  if (body.action === "offer_draw") {
    if (activeRoom.status !== "ready") return NextResponse.json({ error: "Game is not active." }, { status: 409 });
    if (currentPly < 2) {
      return NextResponse.json({ error: "Draw offers unlock after both sides make one move." }, { status: 409 });
    }
    if (activeRoom.draw_offered_by) {
      return NextResponse.json({ error: "There is already an active draw offer." }, { status: 409 });
    }
    const blockedUntil = drawBlockedUntilPly(activeRoom, side);
    if (currentPly < blockedUntil) {
      return NextResponse.json(
        { error: `You can offer a draw again after ${blockedUntil - currentPly} more ply.` },
        { status: 409 },
      );
    }
    patch = { ...patch, draw_offered_by: side, draw_offer_ply: currentPly };
  }

  if (body.action === "decline_draw") {
    if (!activeRoom.draw_offered_by || activeRoom.draw_offered_by === side) {
      return NextResponse.json({ error: "No opponent draw offer to decline." }, { status: 409 });
    }
    const blockedKey =
      activeRoom.draw_offered_by === "white" ? "white_draw_blocked_until_ply" : "black_draw_blocked_until_ply";
    patch = {
      ...patch,
      draw_offered_by: null,
      draw_offer_ply: null,
      [blockedKey]: currentPly + DRAW_REOFFER_COOLDOWN_PLIES,
    };
  }

  if (body.action === "accept_draw") {
    if (!activeRoom.draw_offered_by || activeRoom.draw_offered_by === side) {
      return NextResponse.json({ error: "No opponent draw offer to accept." }, { status: 409 });
    }
    result = "1/2-1/2";
    endReason = "Draw agreement";
    patch = { ...patch, status: "finished", result, end_reason: endReason, draw_offered_by: null, draw_offer_ply: null };
  }

  const { data: updatedRoom, error: updateError } = await supabase
    .from("rooms")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (result && endReason) {
    await saveFinishedRoomGame(activeRoom, { result, endReason });
  }
  return NextResponse.json({ room: mapRoom(updatedRoom) });
}
