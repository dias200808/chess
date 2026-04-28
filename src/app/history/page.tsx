"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { GameMode, GameResult, SavedGame } from "@/lib/types";
import { getSavedGames } from "@/lib/storage";
import { fetchGamesFromSupabase } from "@/lib/supabase-data";
import { ratingTypeLabels } from "@/lib/rating";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card, Field, LinkButton, SelectField } from "@/components/ui";

const ANY = "any";

function opponentName(game: SavedGame, userId?: string) {
  if (userId && game.whiteUserId === userId) return game.blackPlayer ?? game.opponent;
  if (userId && game.blackUserId === userId) return game.whitePlayer ?? game.opponent;
  return game.opponent ?? game.blackPlayer ?? "Opponent";
}

function ratingDelta(game: SavedGame) {
  if (typeof game.whiteRatingChange === "number" || typeof game.blackRatingChange === "number") {
    return `${game.whiteRatingChange ?? 0}/${game.blackRatingChange ?? 0}`;
  }
  if (typeof game.ratingChange === "number") {
    if (game.ratingChange > 0) return `+${game.ratingChange}`;
    return String(game.ratingChange);
  }
  if (typeof game.ratingBefore === "number" && typeof game.ratingAfter === "number") {
    const delta = game.ratingAfter - game.ratingBefore;
    return delta > 0 ? `+${delta}` : String(delta);
  }
  return "0";
}

function downloadPgn(game: SavedGame) {
  const blob = new Blob([game.pgn || "*"], { type: "application/x-chess-pgn;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `game-${game.id}.pgn`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function HistoryPage() {
  const { user } = useAuth();
  const [games, setGames] = useState<SavedGame[]>(() => getSavedGames());
  const [resultFilter, setResultFilter] = useState<GameResult | typeof ANY>(ANY);
  const [modeFilter, setModeFilter] = useState<GameMode | typeof ANY>(ANY);
  const [timeFilter, setTimeFilter] = useState(ANY);
  const [opponentFilter, setOpponentFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    void fetchGamesFromSupabase(user?.id).then((remoteGames) => {
      if (remoteGames) setGames(remoteGames);
    }).catch(() => {});
  }, [user?.id]);

  const timeControls = useMemo(
    () =>
      Array.from(new Set(games.map((game) => game.timeControl).filter(Boolean))).sort() as string[],
    [games],
  );

  const visibleGames = useMemo(() => {
    return games
      .filter((game) => {
        if (resultFilter !== ANY && game.result !== resultFilter) return false;
        if (modeFilter !== ANY && game.mode !== modeFilter) return false;
        if (timeFilter !== ANY && (game.timeControl ?? "") !== timeFilter) return false;
        if (dateFilter && !game.createdAt.startsWith(dateFilter)) return false;
        if (
          opponentFilter.trim() &&
          !opponentName(game, user?.id).toLowerCase().includes(opponentFilter.trim().toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [dateFilter, games, modeFilter, opponentFilter, resultFilter, timeFilter, user?.id]);

  return (
    <div className="grid gap-6">
      <Card>
        <Badge>Saved games</Badge>
        <h1 className="mt-2 text-3xl font-black">Game history</h1>
        <p className="mt-2 text-muted-foreground">
          Every finished game is saved automatically with PGN, FEN, result, end reason, time control, and rating change.
        </p>
      </Card>

      <Card>
        <div className="grid gap-3 md:grid-cols-5">
          <SelectField label="By result" value={resultFilter} onChange={(event) => setResultFilter(event.target.value as GameResult | typeof ANY)}>
            <option value={ANY}>All results</option>
            <option value="1-0">1-0</option>
            <option value="0-1">0-1</option>
            <option value="1/2-1/2">Draw</option>
            <option value="*">In progress</option>
          </SelectField>
          <Field label="By opponent" value={opponentFilter} onChange={(event) => setOpponentFilter(event.target.value)} />
          <SelectField label="By mode" value={modeFilter} onChange={(event) => setModeFilter(event.target.value as GameMode | typeof ANY)}>
            <option value={ANY}>All modes</option>
            <option value="local">Local</option>
            <option value="bot">Bot</option>
            <option value="friend">Friend</option>
            <option value="online">Online</option>
          </SelectField>
          <SelectField label="By time control" value={timeFilter} onChange={(event) => setTimeFilter(event.target.value)}>
            <option value={ANY}>All controls</option>
            {timeControls.map((control) => (
              <option key={control} value={control}>{control}</option>
            ))}
          </SelectField>
          <Field label="By date" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
        </div>
      </Card>

      <Card className="overflow-x-auto">
        {visibleGames.length ? (
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-3">Date</th>
                <th>Opponent</th>
                <th>Mode</th>
                <th>Time</th>
                <th>Result</th>
                <th>Moves</th>
                <th>Rating</th>
                <th>End reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleGames.map((game) => (
                <tr key={game.id} className="border-t">
                  <td className="py-4">{formatDate(game.createdAt)}</td>
                  <td>{opponentName(game, user?.id)}</td>
                  <td>{game.mode}</td>
                  <td>{game.timeControl ?? "No time"}</td>
                  <td><Badge>{game.result}</Badge></td>
                  <td>{game.moves.length}</td>
                  <td>
                    <Badge>
                      {game.rated ? `${ratingDelta(game)} ${game.ratingType ? ratingTypeLabels[game.ratingType] : ""}` : game.gameType ?? "casual"}
                    </Badge>
                  </td>
                  <td>{game.endReason ?? "Unknown"}</td>
                  <td>
                    <div className="flex flex-wrap gap-2 py-3">
                      <Link className="font-semibold text-primary" href={`/analysis?id=${game.id}`}>Open</Link>
                      <Link className="font-semibold text-primary" href={`/analysis?id=${game.id}`}>Analyze</Link>
                      <Button className="h-8 px-3" variant="secondary" onClick={() => downloadPgn(game)}>
                        <Download className="mr-1 h-3.5 w-3.5" />
                        Download PGN
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-12 text-center">
            <h2 className="text-2xl font-black">No games found</h2>
            <p className="mt-2 text-muted-foreground">Play a local or bot game, then it will appear here automatically.</p>
            <LinkButton className="mt-5" href="/play">Play now</LinkButton>
          </div>
        )}
      </Card>
    </div>
  );
}
