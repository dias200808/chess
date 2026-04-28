import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Claiming guest games needs SUPABASE_SERVICE_ROLE_KEY on Vercel." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    guestKey?: string;
    userId?: string;
    username?: string;
    gameIds?: string[];
  };

  const guestKey = body.guestKey?.trim();
  const userId = body.userId?.trim();
  const username = body.username?.trim();
  const gameIds = Array.isArray(body.gameIds) ? body.gameIds.filter(Boolean) : [];

  if (!guestKey || !userId) {
    return NextResponse.json({ error: "Missing guest key or user id." }, { status: 400 });
  }

  const claimedGameIds: string[] = [];

  if (gameIds.length) {
    const { data: games, error } = await supabase.from("games").select("*").in("id", gameIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    for (const game of games ?? []) {
      const patch: Record<string, unknown> = {};

      if (game.white_guest_key === guestKey && !game.white_user_id) {
        patch.white_user_id = userId;
        if (username) patch.white_player = username;
      }
      if (game.black_guest_key === guestKey && !game.black_user_id) {
        patch.black_user_id = userId;
        if (username) patch.black_player = username;
      }

      if (!Object.keys(patch).length) continue;
      const { error: updateError } = await supabase.from("games").update(patch).eq("id", game.id);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      claimedGameIds.push(String(game.id));
    }
  }

  return NextResponse.json({ claimedGameIds });
}
