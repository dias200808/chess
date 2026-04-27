"use client";

import { useState } from "react";
import { Bot, ChevronLeft, Cpu, Swords, Zap } from "lucide-react";
import { BoardStagePreview } from "@/components/board-stage-preview";
import { ChessGame } from "@/components/chess-game";
import { getTimeControlPreset, timeControlPresets } from "@/lib/game-config";
import { botProfiles, getBotProfile } from "@/lib/bot-profiles";
import type { BotDifficulty } from "@/lib/types";
import { Badge, Button, SelectField } from "@/components/ui";

export default function BotPage() {
  const [colorChoice, setColorChoice] = useState<"white" | "black" | "random">("white");
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [difficulty, setDifficulty] = useState<BotDifficulty>("elo-800");
  const [timeControlId, setTimeControlId] = useState("10-0");
  const [started, setStarted] = useState(false);
  const profile = getBotProfile(difficulty);
  const timeControl = getTimeControlPreset(timeControlId);

  function chooseColor(value: "white" | "black" | "random") {
    setColorChoice(value);
    setPlayerColor(
      value === "random"
        ? crypto.getRandomValues(new Uint8Array(1))[0] > 127
          ? "white"
          : "black"
        : value,
    );
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
          К настройке бота
        </Button>
        <ChessGame
          key={`${playerColor}-${difficulty}-${timeControl.id}`}
          mode="bot"
          playerColor={playerColor}
          difficulty={difficulty}
          timeControl={timeControl}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_32rem]">
      <BoardStagePreview
        topLabel={profile.name}
        topMeta={`Рейтинг ${profile.elo}`}
        bottomLabel="Вы"
        bottomMeta={`${playerColor === "white" ? "Белые" : "Черные"} • ${timeControl.label}`}
        orientation={playerColor}
      />

      <section className="grid gap-4 rounded-[1.75rem] border border-white/6 bg-[#262421] p-4 text-[#f4efe4] shadow-2xl shadow-black/20">
        <div className="border-b border-white/6 px-1 pb-4">
          <Badge className="border-[#5f8443] bg-[#4d6a36] text-[#f7f2e7]">Игра с ботом</Badge>
          <h1 className="mt-3 text-4xl font-black text-white">Выберите соперника</h1>
          <p className="mt-2 text-sm leading-6 text-[#beb6a7]">
            Настройте цвет, силу соперника и контроль времени, затем начните партию.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1">
          <section className="rounded-[1.6rem] border border-white/7 bg-[#34312d] p-5">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#4d6a36] text-white">
                <Bot className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-black text-white">{profile.name}</h2>
                <p className="mt-1 text-sm text-[#d8cfbf]">Elo {profile.elo}</p>
                <p className="mt-3 text-sm leading-6 text-[#beb6a7]">{profile.description}</p>
              </div>
            </div>
          </section>

          <section className="grid gap-3 rounded-[1.6rem] border border-white/7 bg-[#34312d] p-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <SelectField
                label="Ваш цвет"
                value={colorChoice}
                className="border-white/10 bg-[#262421] text-white"
                onChange={(event) => chooseColor(event.target.value as typeof colorChoice)}
              >
                <option value="white">Белые</option>
                <option value="black">Черные</option>
                <option value="random">Случайно</option>
              </SelectField>
              <SelectField
                label="Сила бота"
                value={difficulty}
                className="border-white/10 bg-[#262421] text-white"
                onChange={(event) => setDifficulty(event.target.value as BotDifficulty)}
              >
                {botProfiles.map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.elo} - {bot.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Контроль времени"
                value={timeControlId}
                className="border-white/10 bg-[#262421] text-white"
                onChange={(event) => setTimeControlId(event.target.value)}
              >
                {timeControlPresets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-3">
              <section className="rounded-2xl bg-[#262421] p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-[#8f8a80]">Режим</p>
                <p className="mt-2 text-lg font-black text-white">
                  {profile.useStockfish ? "Stockfish" : "Локальный AI"}
                </p>
              </section>
              <section className="rounded-2xl bg-[#262421] p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-[#8f8a80]">Стиль</p>
                <p className="mt-2 text-lg font-black text-white">
                  {profile.elo <= 800 ? "Мягкий" : profile.elo <= 1600 ? "Сбаланс." : "Жесткий"}
                </p>
              </section>
              <section className="rounded-2xl bg-[#262421] p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-[#8f8a80]">Время</p>
                <p className="mt-2 text-lg font-black text-white">{timeControl.label}</p>
              </section>
            </div>

            <Button onClick={() => setStarted(true)}>Начать игру с ботом</Button>
          </section>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <section className="rounded-[1.4rem] border border-white/7 bg-[#34312d] p-4">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-[#f0c44f]" />
              <p className="font-bold text-white">Быстрый старт</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#beb6a7]">
              Выбрали бота, время и цвет, затем сразу перешли к партии.
            </p>
          </section>
          <section className="rounded-[1.4rem] border border-white/7 bg-[#34312d] p-4">
            <div className="flex items-center gap-3">
              <Cpu className="h-5 w-5 text-[#92c463]" />
              <p className="font-bold text-white">Сильный движок</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#beb6a7]">
              Верхние уровни теперь считают заметно глубже и играют жестче.
            </p>
          </section>
          <section className="rounded-[1.4rem] border border-white/7 bg-[#34312d] p-4">
            <div className="flex items-center gap-3">
              <Swords className="h-5 w-5 text-[#92c463]" />
              <p className="font-bold text-white">После партии</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#beb6a7]">
              Сразу доступны часы, качество ходов, точность и переход к полному анализу.
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}
