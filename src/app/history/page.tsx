"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SavedGame } from "@/lib/types";
import { getSavedGames } from "@/lib/storage";
import { fetchGamesFromSupabase } from "@/lib/supabase-data";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { Badge, Card, LinkButton } from "@/components/ui";

export default function HistoryPage() {
  const { user } = useAuth();
  const [games, setGames] = useState<SavedGame[]>(() => getSavedGames());

  useEffect(() => {
    void fetchGamesFromSupabase(user?.id).then((remoteGames) => {
      if (remoteGames) setGames(remoteGames);
    }).catch(() => {});
  }, [user?.id]);

  return (
    <div className="grid gap-6">
      <Card>
        <Badge>Saved games</Badge>
        <h1 className="mt-2 text-3xl font-black">Game history</h1>
        <p className="mt-2 text-muted-foreground">
          Saved games include mode, result, opponent, PGN, final position, and analysis metadata.
        </p>
      </Card>

      <Card className="overflow-x-auto">
        {games.length ? (
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-3">Date</th>
                <th>Mode</th>
                <th>Result</th>
                <th>Opponent</th>
                <th>Moves</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <tr key={game.id} className="border-t">
                  <td className="py-4">{formatDate(game.createdAt)}</td>
                  <td>{game.mode}</td>
                  <td><Badge>{game.result}</Badge></td>
                  <td>{game.opponent}</td>
                  <td>{game.moves.length}</td>
                  <td className="flex gap-2 py-3">
                    <Link className="font-semibold text-primary" href={`/analysis?id=${game.id}`}>Open</Link>
                    <Link className="font-semibold text-primary" href={`/analysis?id=${game.id}`}>Analyze</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-12 text-center">
            <h2 className="text-2xl font-black">No games saved yet</h2>
            <p className="mt-2 text-muted-foreground">Play a local or bot game, then press Save Game.</p>
            <LinkButton className="mt-5" href="/play">Play now</LinkButton>
          </div>
        )}
      </Card>
    </div>
  );
}
