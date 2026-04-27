"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Badge, Card, SelectField } from "@/components/ui";
import { seededPlayers } from "@/lib/data";
import { ratingForProfile, ratingTypeLabels } from "@/lib/rating";
import type { RatingType, UserProfile } from "@/lib/types";
import { percentage } from "@/lib/utils";

type Scope = "global" | "city" | "country";
type RatingFilter = RatingType | "overall";

const ratingFilters: RatingFilter[] = ["overall", "bullet", "blitz", "rapid", "classical", "puzzle"];

function uniqueValues(players: UserProfile[], field: "city" | "country") {
  return Array.from(
    new Set(players.map((player) => player[field]).filter((value) => value && value !== "Unknown")),
  ).sort();
}

export default function LeaderboardPage() {
  const { profiles, user } = useAuth();
  const players = useMemo(() => [...profiles, ...seededPlayers], [profiles]);
  const [scope, setScope] = useState<Scope>("global");
  const [ratingType, setRatingType] = useState<RatingFilter>("overall");
  const [city, setCity] = useState(user?.city && user.city !== "Unknown" ? user.city : "Almaty");
  const [country, setCountry] = useState(user?.country && user.country !== "Unknown" ? user.country : "Kazakhstan");

  const cities = useMemo(() => uniqueValues(players, "city"), [players]);
  const countries = useMemo(() => uniqueValues(players, "country"), [players]);

  const rankedPlayers = useMemo(() => {
    return players
      .filter((player) => {
        if (scope === "city") return player.city === city;
        if (scope === "country") return player.country === country;
        return true;
      })
      .map((player) => ({
        ...player,
        displayRating: ratingForProfile(player, ratingType),
      }))
      .sort((a, b) => b.displayRating - a.displayRating || b.gamesCount - a.gamesCount);
  }, [city, country, players, ratingType, scope]);

  const userRank = user
    ? rankedPlayers.findIndex((player) => player.id === user.id) + 1
    : 0;

  return (
    <div className="grid gap-6">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge>{scope === "global" ? "Global" : scope === "city" ? city : country}</Badge>
            <h1 className="mt-2 text-3xl font-black">Leaderboard</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Rankings are sorted by the selected rating type. Local games and no-time games stay casual and do not change rating.
            </p>
          </div>
          {userRank > 0 ? (
            <Badge className="bg-primary/15 text-primary">Your place: #{userRank}</Badge>
          ) : null}
        </div>
      </Card>

      <Card>
        <div className="grid gap-3 md:grid-cols-4">
          <SelectField label="Scope" value={scope} onChange={(event) => setScope(event.target.value as Scope)}>
            <option value="global">Global</option>
            <option value="city">City</option>
            <option value="country">Country</option>
          </SelectField>
          <SelectField
            label="Rating type"
            value={ratingType}
            onChange={(event) => setRatingType(event.target.value as RatingFilter)}
          >
            {ratingFilters.map((type) => (
              <option key={type} value={type}>{ratingTypeLabels[type]}</option>
            ))}
          </SelectField>
          <SelectField label="City" value={city} onChange={(event) => setCity(event.target.value)}>
            {cities.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </SelectField>
          <SelectField label="Country" value={country} onChange={(event) => setCountry(event.target.value)}>
            {countries.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </SelectField>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-3">Place</th>
              <th>Username</th>
              <th>City</th>
              <th>Country</th>
              <th>{ratingTypeLabels[ratingType]}</th>
              <th>Games</th>
              <th>Win rate</th>
            </tr>
          </thead>
          <tbody>
            {rankedPlayers.map((player, index) => (
              <tr key={player.id} className="border-t">
                <td className="py-4 font-mono">#{index + 1}</td>
                <td className="font-semibold">
                  <span className="mr-3 inline-grid h-9 w-9 place-items-center rounded-xl bg-muted font-black">
                    {player.avatar}
                  </span>
                  {player.username}
                  {player.id === user?.id ? <Badge className="ml-2">You</Badge> : null}
                </td>
                <td>{player.city || "Unknown"}</td>
                <td>{player.country || "Unknown"}</td>
                <td className="font-mono text-lg font-black">{player.displayRating}</td>
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
