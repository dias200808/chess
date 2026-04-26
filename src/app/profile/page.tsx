"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card, Field, LinkButton } from "@/components/ui";
import { getSavedGames, getPuzzleState } from "@/lib/storage";
import { percentage } from "@/lib/utils";

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ username: user?.username ?? "" });

  if (!user) {
    return (
      <Card className="mx-auto max-w-xl">
        <h1 className="text-3xl font-black">Профиль защищён</h1>
        <p className="mt-2 text-muted-foreground">Зарегистрируйтесь или войдите, чтобы видеть рейтинг, статистику и последние партии.</p>
        <div className="mt-5 flex gap-3">
          <LinkButton href="/register">Регистрация</LinkButton>
          <LinkButton href="/login" variant="secondary">Войти</LinkButton>
        </div>
      </Card>
    );
  }

  const games = getSavedGames().filter(
    (game) => game.whiteUserId === user.id || game.blackUserId === user.id,
  );
  const puzzleState = getPuzzleState();
  const solvedPuzzles = Object.values(puzzleState).filter((item) => item.solved).length;

  function saveProfile() {
    updateProfile(draft);
    setEditing(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <Card>
        <div className="grid h-24 w-24 place-items-center rounded-[2rem] bg-primary text-3xl font-black text-primary-foreground">
          {user.avatar}
        </div>
        <h1 className="mt-5 text-3xl font-black">{user.username}</h1>
        <p className="text-muted-foreground">{user.email}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>{user.rating} рейтинг</Badge>
        </div>

        {editing ? (
          <div className="mt-6 grid gap-3">
            <Field label="Имя пользователя" value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} />
            <Button onClick={saveProfile}>Сохранить</Button>
          </div>
        ) : (
          <Button
            className="mt-6"
            variant="secondary"
            onClick={() => {
              setDraft({ username: user.username });
              setEditing(true);
            }}
          >
            Редактировать профиль
          </Button>
        )}
      </Card>

      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Партии", user.gamesCount],
            ["Победы", user.wins],
            ["Поражения", user.losses],
            ["Ничьи", user.draws],
          ].map(([label, value]) => (
            <Card key={label}>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 font-mono text-4xl font-black">{value}</p>
            </Card>
          ))}
        </div>

        <Card>
          <h2 className="text-xl font-black">Прогресс</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-muted p-5">
              <p className="text-sm text-muted-foreground">Процент побед</p>
              <p className="font-mono text-4xl font-black">{percentage(user.wins, user.gamesCount)}%</p>
            </div>
            <div className="rounded-3xl bg-muted p-5">
              <p className="text-sm text-muted-foreground">Решено задач</p>
              <p className="font-mono text-4xl font-black">{solvedPuzzles}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-black">Последние партии</h2>
            <Link className="text-sm font-semibold text-primary" href="/history">Все партии</Link>
          </div>
          <div className="mt-4 grid gap-3">
            {games.slice(0, 5).map((game) => (
              <div key={game.id} className="flex items-center justify-between rounded-2xl bg-muted p-4">
                <span className="font-medium">{game.mode} vs {game.opponent}</span>
                <Badge>{game.result}</Badge>
              </div>
            ))}
            {!games.length ? <p className="text-sm text-muted-foreground">Пока нет сохранённых партий.</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
