"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card, Field, LinkButton } from "@/components/ui";
import { ratingTypeLabels } from "@/lib/rating";
import { getPuzzleState, getSavedGames } from "@/lib/storage";
import type { SavedGame, UserProfile } from "@/lib/types";
import { formatDate, percentage } from "@/lib/utils";

function resultForUser(game: SavedGame, userId: string) {
  if (game.winner === "draw" || game.result === "1/2-1/2") return "draw";
  const userSide = game.whiteUserId === userId ? "white" : game.blackUserId === userId ? "black" : null;
  if (!userSide || !game.winner) return "unknown";
  return game.winner === userSide ? "win" : "loss";
}

function currentStreak(games: SavedGame[], userId: string) {
  let streak = 0;
  let streakType: "win" | "loss" | null = null;

  for (const game of games) {
    const result = resultForUser(game, userId);
    if (result === "draw" || result === "unknown") break;
    if (!streakType) streakType = result;
    if (result !== streakType) break;
    streak += 1;
  }

  if (!streakType || streak === 0) return "0";
  return `${streakType === "win" ? "+" : "-"}${streak}`;
}

function averageAccuracy(games: SavedGame[], userId: string) {
  const values = games
    .map((game) => {
      if (game.whiteUserId === userId) return game.whiteAccuracy;
      if (game.blackUserId === userId) return game.blackAccuracy;
      return game.whiteUserId || game.blackUserId ? null : Math.round((game.whiteAccuracy + game.blackAccuracy) / 2);
    })
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);

  if (!values.length) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function bestPuzzleRating() {
  const progress = Object.values(getPuzzleState());
  return Math.max(800, ...progress.map((item) => item.bestPuzzleRating ?? item.puzzleRating ?? 800));
}

function normalizeDraft(user: UserProfile) {
  return {
    username: user.username,
    avatar: user.avatar,
    city: user.city,
    country: user.country,
  };
}

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    username: "",
    avatar: "",
    city: "",
    country: "",
  });

  const allGames = useMemo(() => getSavedGames(), []);

  if (!user) {
    return (
      <Card className="mx-auto max-w-xl">
        <h1 className="text-3xl font-black">Профиль защищён</h1>
        <p className="mt-2 text-muted-foreground">
          Зарегистрируйтесь или войдите, чтобы видеть рейтинг, статистику и последние партии.
        </p>
        <div className="mt-5 flex gap-3">
          <LinkButton href="/register">Регистрация</LinkButton>
          <LinkButton href="/login" variant="secondary">Войти</LinkButton>
        </div>
      </Card>
    );
  }

  const profile = user;
  const games = allGames
    .filter((game) => game.whiteUserId === profile.id || game.blackUserId === profile.id || (!game.whiteUserId && !game.blackUserId))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const gamesPlayed = Math.max(profile.gamesCount, games.length);
  const winRate = percentage(profile.wins, gamesPlayed);
  const puzzleRating = bestPuzzleRating();
  const accuracy = averageAccuracy(games, profile.id);
  const streak = currentStreak(games, profile.id);

  async function saveProfile() {
    await updateProfile({
      username: draft.username.trim() || profile.username,
      avatar: draft.avatar.trim().slice(0, 4).toUpperCase() || profile.avatar,
      city: draft.city.trim() || "Unknown",
      country: draft.country.trim() || "Unknown",
    });
    setEditing(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[24rem_1fr]">
      <Card>
        <div className="grid h-28 w-28 place-items-center rounded-[2rem] bg-primary text-4xl font-black text-primary-foreground">
          {profile.avatar}
        </div>
        <h1 className="mt-5 text-3xl font-black">{profile.username}</h1>
        <p className="text-muted-foreground">{profile.email}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>{profile.rating} rating</Badge>
          <Badge>{profile.city || "Unknown city"}</Badge>
          <Badge>{profile.country || "Unknown country"}</Badge>
        </div>

        {editing ? (
          <div className="mt-6 grid gap-3">
            <Field
              label="Username"
              value={draft.username}
              onChange={(event) => setDraft({ ...draft, username: event.target.value })}
            />
            <Field
              label="Avatar"
              maxLength={4}
              value={draft.avatar}
              onChange={(event) => setDraft({ ...draft, avatar: event.target.value })}
            />
            <Field
              label="City"
              value={draft.city}
              onChange={(event) => setDraft({ ...draft, city: event.target.value })}
            />
            <Field
              label="Country"
              value={draft.country}
              onChange={(event) => setDraft({ ...draft, country: event.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={saveProfile}>Save</Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button
            className="mt-6"
            variant="secondary"
            onClick={() => {
              setDraft(normalizeDraft(profile));
              setEditing(true);
            }}
          >
            Edit Profile
          </Button>
        )}
      </Card>

      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Rating", profile.rating],
            [ratingTypeLabels.bullet, profile.bulletRating ?? profile.rating],
            [ratingTypeLabels.blitz, profile.blitzRating ?? profile.rating],
            [ratingTypeLabels.rapid, profile.rapidRating ?? profile.rating],
            [ratingTypeLabels.classical, profile.classicalRating ?? profile.rating],
            ["Games played", gamesPlayed],
            ["Wins", profile.wins],
            ["Losses", profile.losses],
            ["Draws", profile.draws],
            ["Win rate", `${winRate}%`],
            ["Current streak", streak],
            ["Puzzle rating", Math.max(profile.puzzleRating ?? 1200, puzzleRating)],
          ].map(([label, value]) => (
            <Card key={label}>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 font-mono text-4xl font-black">{value}</p>
            </Card>
          ))}
        </div>

        <Card>
          <h2 className="text-xl font-black">Performance</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-muted p-5">
              <p className="text-sm text-muted-foreground">Average accuracy</p>
              <p className="font-mono text-4xl font-black">{accuracy}%</p>
            </div>
            <div className="rounded-3xl bg-muted p-5">
              <p className="text-sm text-muted-foreground">Profile</p>
              <p className="mt-2 text-sm font-semibold">
                {profile.username} · {profile.city || "Unknown city"}, {profile.country || "Unknown country"}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-black">Recent games</h2>
            <Link className="text-sm font-semibold text-primary" href="/history">All games</Link>
          </div>
          <div className="mt-4 grid gap-3">
            {games.slice(0, 8).map((game) => {
              const result = resultForUser(game, profile.id);
              return (
                <div key={game.id} className="grid gap-3 rounded-2xl bg-muted p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <div>
                    <p className="font-semibold">{game.mode} vs {game.opponent}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(game.createdAt)} · {game.moves.length} moves</p>
                  </div>
                  <Badge>{result}</Badge>
                  <Badge>{game.result}</Badge>
                </div>
              );
            })}
            {!games.length ? <p className="text-sm text-muted-foreground">Пока нет сохранённых партий.</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
