"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Badge, Card, SelectField } from "@/components/ui";
import { seededPlayers } from "@/lib/data";
import { percentage } from "@/lib/utils";

export default function LeaderboardPage() {
  const { profiles } = useAuth();
  const players = useMemo(() => [...profiles, ...seededPlayers], [profiles]);
  const cities = ["All", ...Array.from(new Set(players.map((player) => player.city)))];
  const [city, setCity] = useState("All");
  const filtered = players
    .filter((player) => city === "All" || player.city === city)
    .sort((a, b) => b.rating - a.rating);

  return (
    <div className="grid gap-6">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge>Global ladder</Badge>
            <h1 className="mt-2 text-3xl font-black">Leaderboard</h1>
            <p className="mt-2 text-muted-foreground">Sort by rating globally or filter by city.</p>
          </div>
          <SelectField label="City filter" value={city} onChange={(event) => setCity(event.target.value)}>
            {cities.map((item) => <option key={item}>{item}</option>)}
          </SelectField>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-3">Rank</th>
              <th>Username</th>
              <th>City</th>
              <th>Rating</th>
              <th>Games</th>
              <th>Win %</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((player, index) => (
              <tr key={player.id} className="border-t">
                <td className="py-4 font-mono">#{index + 1}</td>
                <td className="font-semibold">{player.username}</td>
                <td>{player.city}</td>
                <td className="font-mono font-bold">{player.rating}</td>
                <td>{player.gamesCount}</td>
                <td>{percentage(player.wins, player.gamesCount)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
