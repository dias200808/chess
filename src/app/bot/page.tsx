"use client";

import { useEffect, useState } from "react";
import { Bot, ChevronLeft, Clock3, Cpu, Grid2x2, Sparkles, User2, Users } from "lucide-react";
import { BoardStagePreview } from "@/components/board-stage-preview";
import { ChessGame } from "@/components/chess-game";
import { Badge, Button, SelectField } from "@/components/ui";
import { botProfiles, getBotProfile } from "@/lib/bot-profiles";
import { getTimeControlPreset, timeControlPresets } from "@/lib/game-config";
import type { BotDifficulty } from "@/lib/types";

const QUICK_BOT_PRESETS: BotDifficulty[] = ["elo-400", "elo-800", "elo-1200", "elo-1600", "elo-2000", "stockfish"];
const BOT_TIME_PRESETS = ["no-time", "1-0", "3-0", "5-0", "10-0", "15-10"] as const;

function describeBot(profile: ReturnType<typeof getBotProfile>) {
  return `${profile.title}. ${profile.description}`;
}

function TopTab({
  label,
  icon: Icon,
  active = false,
}: {
  label: string;
  icon: typeof Bot;
  active?: boolean;
}) {
  return (
    <div
      className={`grid flex-1 place-items-center gap-2 rounded-xl px-3 py-3 text-center ${
        active ? "bg-[#2f2b27] text-white" : "text-[#beb4a0]"
      }`}
    >
      <Icon className="h-6 w-6" />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}

function SegmentedChoice({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-sm font-black transition ${
        active
          ? "border-[#79c66a] bg-[linear-gradient(180deg,#314d2a_0%,#243722_100%)] text-white"
          : "border-[#4d4841] bg-[linear-gradient(180deg,#403c37_0%,#35312d_100%)] text-[#eadfce] hover:brightness-110"
      }`}
    >
      {label}
    </button>
  );
}

function InfoCard({
  title,
  value,
  accent = "text-[#8bc34a]",
}: {
  title: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-[#4a453f] bg-[#2a2723] px-3 py-3">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-[#9f9584]">{title}</p>
      <p className={`mt-2 text-lg font-black ${accent}`}>{value}</p>
    </div>
  );
}

export default function BotPage() {
  const [colorChoice, setColorChoice] = useState<"white" | "black" | "random">("white");
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [difficulty, setDifficulty] = useState<BotDifficulty>("elo-800");
  const [timeControlId, setTimeControlId] = useState("10-0");
  const [started, setStarted] = useState(false);
  const profile = getBotProfile(difficulty);
  const timeControl = getTimeControlPreset(timeControlId);
  const quickBots = QUICK_BOT_PRESETS.map((id) => getBotProfile(id));
  const quickTimes = BOT_TIME_PRESETS.map((id) => getTimeControlPreset(id));

  useEffect(() => {
    function resetBotPage(event: Event) {
      if ((event as CustomEvent<string>).detail === "/bot") setStarted(false);
    }

    window.addEventListener("knightly:navigate-home", resetBotPage);
    return () => window.removeEventListener("knightly:navigate-home", resetBotPage);
  }, []);

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
          Back to bot setup
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
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_30rem]">
      <BoardStagePreview
        topLabel={profile.name}
        topMeta={`Bot Elo ${profile.elo} | ${profile.title} | ${profile.personality}`}
        bottomLabel="You"
        bottomMeta={`${playerColor === "white" ? "White" : "Black"} | ${
          timeControl.initialSeconds === null ? "No clock" : timeControl.label
        }`}
        orientation={playerColor}
      />

      <section className="rounded-[1.35rem] border border-[#45403a] bg-[#24211d] p-4 text-[#fff7eb] shadow-[0_20px_55px_rgba(0,0,0,0.2)]">
        <div className="grid grid-cols-3 gap-3 border-b border-white/6 pb-4">
          <TopTab label="Bot Setup" icon={Bot} active />
          <TopTab label="Games" icon={Grid2x2} />
          <TopTab label="Players" icon={Users} />
        </div>

        <div className="mt-4 rounded-[1.15rem] border border-[#4b463f] bg-[linear-gradient(180deg,#47433e_0%,#393530_100%)] px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#3a342d] text-[#7ac97f]">
              <Bot className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-[2.45rem] font-black tracking-tight text-white">Play Bots</h1>
              <p className="mt-1 text-sm text-[#c5baaa]">Choose bot Elo, side, and clock, then start instantly.</p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[1rem] border border-[#4d4841] bg-[#2c2925] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-[#b9ae9d]">Current bot</p>
              <p className="mt-1 text-3xl font-black text-white">{profile.name}</p>
              <p className="mt-1 text-sm text-[#d5cbba]">
                Elo {profile.elo} | {profile.title} | {profile.useStockfish ? "Stockfish-powered" : "Heuristic training bot"}
              </p>
            </div>
            <Badge className="border-[#545048] bg-[#34302b] text-[#ede3d1]">
              {timeControl.initialSeconds === null ? "No clock" : timeControl.label}
            </Badge>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#c7bdad]">{describeBot(profile)}</p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <InfoCard title="Bot rating" value={String(profile.elo)} />
            <InfoCard title="Engine" value={profile.useStockfish ? `SF ${profile.stockfishDepth}` : `Depth ${profile.fallbackDepth}`} />
            <InfoCard
              title="Clock"
              value={timeControl.initialSeconds === null ? "Untimed" : timeControl.label}
              accent="text-white"
            />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <InfoCard title="Personality" value={profile.personality} accent="text-white" />
            <InfoCard title="Openings" value={profile.openingStyle} accent="text-white" />
            <InfoCard title="Think delay" value={`${profile.thinkDelayMs[0]}-${profile.thinkDelayMs[1]}ms`} accent="text-white" />
          </div>
        </div>

        <div className="mt-4 rounded-[1rem] border border-[#4d4841] bg-[#2c2925] p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#2f2b27] text-[#8bc34a]">
              <User2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-black text-white">Choose your side</p>
              <p className="text-sm text-[#c8bead]">Pick white, black, or let it randomize.</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <SegmentedChoice label="White" active={colorChoice === "white"} onClick={() => chooseColor("white")} />
            <SegmentedChoice label="Black" active={colorChoice === "black"} onClick={() => chooseColor("black")} />
            <SegmentedChoice label="Random" active={colorChoice === "random"} onClick={() => chooseColor("random")} />
          </div>
        </div>

        <div className="mt-4 rounded-[1rem] border border-[#4d4841] bg-[#2c2925] p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#2f2b27] text-[#8bc34a]">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-black text-white">Choose bot rating</p>
              <p className="text-sm text-[#c8bead]">Quick presets first, full list below.</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {quickBots.map((bot) => (
              <SegmentedChoice
                key={bot.id}
                label={bot.id === "stockfish" ? "Max" : String(bot.elo)}
                active={difficulty === bot.id}
                onClick={() => setDifficulty(bot.id)}
              />
            ))}
          </div>

          <div className="mt-3">
            <SelectField
              label="Full bot list"
              value={difficulty}
              className="border-[#4f4a44] bg-[#181613] text-white"
              onChange={(event) => setDifficulty(event.target.value as BotDifficulty)}
            >
              {botProfiles.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.elo} - {bot.name} ({bot.title})
                </option>
              ))}
            </SelectField>
          </div>
        </div>

        <div className="mt-4 rounded-[1rem] border border-[#4d4841] bg-[#2c2925] p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#2f2b27] text-[#8bc34a]">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-black text-white">Choose a clock</p>
              <p className="text-sm text-[#c8bead]">Play untimed or use one of the common presets.</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {quickTimes.map((preset) => (
              <SegmentedChoice
                key={preset.id}
                label={preset.initialSeconds === null ? "No time" : preset.label}
                active={preset.id === timeControlId}
                onClick={() => setTimeControlId(preset.id)}
              />
            ))}
          </div>

          <div className="mt-3">
            <SelectField
              label="Advanced clock list"
              value={timeControlId}
              className="border-[#4f4a44] bg-[#181613] text-white"
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

        <Button
          className="mt-5 h-16 w-full rounded-2xl bg-[linear-gradient(180deg,#8dc84f_0%,#6ba83f_100%)] text-2xl font-black text-white shadow-[0_16px_35px_rgba(124,186,77,0.28)]"
          onClick={() => setStarted(true)}
        >
          Start Bot Game
        </Button>

        <div className="mt-4 rounded-[0.95rem] border border-[#4b463f] bg-[#2a2723] px-4 py-3 text-sm text-[#d4cab9]">
          Bot games are training games. Online ratings stay separate by format: bullet, blitz, rapid, and
          classical each have their own rating.
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-white/6 pt-4 text-sm font-semibold text-[#c6bba9]">
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Instant training
          </span>
          <span className="inline-flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Elo-based bots
          </span>
          <span className="inline-flex items-center gap-2">
            <Clock3 className="h-4 w-4" />
            Timed or untimed
          </span>
        </div>
      </section>
    </div>
  );
}
