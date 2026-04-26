"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/auth-provider";
import { Badge, Card } from "@/components/ui";
import { seededPlayers } from "@/lib/data";
import { percentage } from "@/lib/utils";

export default function LeaderboardPage() {
  const { profiles } = useAuth();
  const players = useMemo(() => [...profiles, ...seededPlayers], [profiles]);
  const filtered = players
    .sort((a, b) => b.rating - a.rating);

  return (
    <div className="grid gap-6">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge>Глобальный рейтинг</Badge>
            <h1 className="mt-2 text-3xl font-black">Таблица лидеров</h1>
            <p className="mt-2 text-muted-foreground">Игроки отсортированы по рейтингу без фильтра по городу.</p>
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-3">Место</th>
              <th>Игрок</th>
              <th>Рейтинг</th>
              <th>Партии</th>
              <th>Победы %</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((player, index) => (
              <tr key={player.id} className="border-t">
                <td className="py-4 font-mono">#{index + 1}</td>
                <td className="font-semibold">{player.username}</td>
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
