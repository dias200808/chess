"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Bot, ChevronLeft, Globe2, History, Loader2, Swords, Trophy, Users } from "lucide-react";
import { BoardStagePreview } from "@/components/board-stage-preview";
import { ChessGame } from "@/components/chess-game";
import { getTimeControlPreset, timeControlPresets } from "@/lib/game-config";
import { Badge, Button, LinkButton, SelectField } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import {
  createQuickMatchRoom,
  findWaitingQuickRoom,
  isSupabaseConfigured,
  joinQuickMatchRoom,
} from "@/lib/supabase-data";
import { ratingForProfile, ratingTypeForTimeControl } from "@/lib/rating";

function StartTile({
  title,
  text,
  icon: Icon,
  action,
}: {
  title: string;
  text: string;
  icon: LucideIcon;
  action: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.6rem] border border-white/7 bg-[#34312d] p-5 text-[#f4efe4] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#4d6a36] text-white shadow-lg shadow-black/20">
          <Icon className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-black text-white">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[#c8c1b3]">{text}</p>
          <div className="mt-4">{action}</div>
        </div>
      </div>
    </section>
  );
}

function guestPlayerKey() {
  const key = "knightly-guest-player-key";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = `guest:${crypto.randomUUID()}`;
  localStorage.setItem(key, next);
  return next;
}

function roomSideKey(roomId: string) {
  return `knightly-room:${roomId}:side`;
}

function PlayPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const initialFen = params.get("fen") ?? undefined;
  const [started, setStarted] = useState(false);
  const [timeControlId, setTimeControlId] = useState("10-0");
  const [isQuickMatching, setIsQuickMatching] = useState(false);
  const [quickMessage, setQuickMessage] = useState("");
  const timeControl = getTimeControlPreset(timeControlId);
  const ratingType = ratingTypeForTimeControl(timeControl);
  const playerRating = user && ratingType ? ratingForProfile(user, ratingType) : null;

  async function startQuickMatch() {
    if (!isSupabaseConfigured()) {
      setQuickMessage("Online matchmaking needs Supabase env vars on Vercel.");
      return;
    }

    setIsQuickMatching(true);
    setQuickMessage("Searching for an opponent...");

    try {
      const playerKey = user ? `user:${user.id}` : guestPlayerKey();
      const waitingRoom = await findWaitingQuickRoom({
        timeControl: timeControl.id,
        playerKey,
        rating: playerRating,
      });

      if (waitingRoom) {
        const joinedRoom = await joinQuickMatchRoom({
          roomId: waitingRoom.id,
          playerKey,
          rating: playerRating,
        });
        if (joinedRoom) {
          localStorage.setItem(roomSideKey(joinedRoom.id), "black");
          router.push(`/friend?room=${joinedRoom.id}`);
          return;
        }
      }

      const createdRoom = await createQuickMatchRoom({
        timeControl: timeControl.id,
        playerKey,
        rating: playerRating,
      });

      if (!createdRoom) {
        setQuickMessage("Could not create matchmaking room.");
        setIsQuickMatching(false);
        return;
      }

      localStorage.setItem(roomSideKey(createdRoom.id), "white");
      router.push(`/friend?room=${createdRoom.id}`);
    } catch {
      setQuickMessage("Matchmaking failed. Check Supabase room policies.");
      setIsQuickMatching(false);
    }
  }

  if (started) {
    return (
      <div className="grid gap-4">
        <Button
          variant="secondary"
          className="w-fit border-white/10 bg-white/6 text-white hover:bg-white/12"
          onClick={() => setStarted(false)}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          К выбору режима
        </Button>
        <ChessGame
          key={`local-${timeControl.id}-${initialFen ?? "start"}`}
          mode="local"
          timeControl={timeControl}
          initialFen={initialFen}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_32rem]">
      <BoardStagePreview
        topLabel="Соперник"
        topMeta="Выберите режим справа"
        bottomLabel="Игрок"
        bottomMeta={`Контроль: ${timeControl.label}`}
      />

      <section className="grid gap-4 rounded-[1.75rem] border border-white/6 bg-[#262421] p-4 shadow-2xl shadow-black/20">
        <div className="border-b border-white/6 px-1 pb-4">
          <Badge className="border-[#5f8443] bg-[#4d6a36] text-[#f7f2e7]">Начать партию</Badge>
          <h1 className="mt-3 text-4xl font-black text-white">Играть в шахматы</h1>
          <p className="mt-2 text-sm leading-6 text-[#beb6a7]">
            Выберите, как хотите начать: локально на одном устройстве, против бота
            или по ссылке с другом.
          </p>
          <div className="mt-4 max-w-xs">
            {initialFen ? (
              <p className="mb-3 rounded-2xl bg-[#34312d] p-3 text-sm font-semibold text-[#f4efe4]">
                Custom start position loaded from FEN.
              </p>
            ) : null}
            <SelectField
              label="Контроль времени"
              value={timeControlId}
              className="border-white/10 bg-[#34312d] text-white"
              onChange={(event) => setTimeControlId(event.target.value)}
            >
              {timeControlPresets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </SelectField>
          </div>
        </div>

        <div className="grid gap-3">
          <StartTile
            title="Quick Online"
            text={
              user
                ? `Finds a live opponent near your ${ratingType ?? "overall"} rating (${playerRating ?? 1200}).`
                : "Play instantly as a guest. No account, no rating, just a live online room."
            }
            icon={Globe2}
            action={
              <div className="grid gap-2">
                <Button onClick={startQuickMatch} disabled={isQuickMatching || Boolean(initialFen)}>
                  {isQuickMatching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Globe2 className="mr-2 h-4 w-4" />
                  )}
                  {isQuickMatching ? "Searching..." : "Play Online"}
                </Button>
                {initialFen ? (
                  <p className="text-xs text-[#c8c1b3]">Quick online starts from the normal chess position.</p>
                ) : null}
                {quickMessage ? <p className="text-xs text-[#c8c1b3]">{quickMessage}</p> : null}
              </div>
            }
          />
          <StartTile
            title="Локальная партия"
            text={`Два игрока за одной доской. Текущий контроль времени: ${timeControl.label}.`}
            icon={Swords}
            action={<Button onClick={() => setStarted(true)}>Начать локальную игру</Button>}
          />
          <StartTile
            title="Играть с ботом"
            text="Выберите уровень, цвет и начните тренировочную партию против компьютерного соперника."
            icon={Bot}
            action={<LinkButton href="/bot">Открыть ботов</LinkButton>}
          />
          <StartTile
            title="Играть с другом"
            text="Создайте комнату и отправьте ссылку. В Supabase-режиме ходы синхронизируются онлайн."
            icon={Users}
            action={<LinkButton href="/friend">Открыть комнаты</LinkButton>}
          />
        </div>

        <div className="mt-1 flex flex-wrap gap-5 border-t border-white/6 px-1 pt-4 text-sm font-semibold text-[#d6cfbf]">
          <Link href="/history" className="inline-flex items-center gap-2 hover:text-white">
            <History className="h-4 w-4" />
            История партий
          </Link>
          <Link href="/leaderboard" className="inline-flex items-center gap-2 hover:text-white">
            <Trophy className="h-4 w-4" />
            Таблица лидеров
          </Link>
        </div>
      </section>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="rounded-[1.75rem] border border-white/6 bg-[#262421] p-6 text-white">Loading play page...</div>}>
      <PlayPageInner />
    </Suspense>
  );
}
