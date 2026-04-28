"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, Globe2, Grid2x2, History, Trophy, User2, Users } from "lucide-react";
import { ChessGame } from "@/components/chess-game";
import { HeroBoard } from "@/components/hero-board";
import { Button } from "@/components/ui";
import { getTimeControlPreset } from "@/lib/game-config";

function TopTab({
  label,
  icon: Icon,
  active = false,
}: {
  label: string;
  icon: LucideIcon;
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

function LobbyShortcut({
  title,
  text,
  meta,
  onClick,
}: {
  title: string;
  text: string;
  meta?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[0.95rem] border border-[#4b463f] bg-[linear-gradient(180deg,#403c37_0%,#35312d_100%)] px-4 py-3 text-left transition hover:brightness-110"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[1.42rem] font-black tracking-tight text-white">{title}</h2>
          <p className="mt-0.5 text-[0.95rem] leading-5 text-[#d3cab9]">{text}</p>
        </div>
        {meta ? (
          <span className="shrink-0 rounded-full border border-[#565048] bg-[#2d2a26] px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#9ad17d]">
            {meta}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export default function PlayPage() {
  const router = useRouter();
  const [localMode, setLocalMode] = useState(false);
  const defaultLocalTime = getTimeControlPreset("10-0");

  if (localMode) {
    return (
      <div className="grid gap-4">
        <Button variant="secondary" className="w-fit" onClick={() => setLocalMode(false)}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to play lobby
        </Button>
        <ChessGame mode="local" timeControl={defaultLocalTime} />
      </div>
    );
  }

  return (
    <section className="rounded-[1.4rem] border border-[#4a453f] bg-[#2e2b27] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.22)] lg:p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_25.5rem]">
        <div className="min-w-0">
          <HeroBoard />
        </div>

        <section className="rounded-[1.2rem] border border-[#433f39] bg-[#24211e] p-4 text-[#fff7eb] shadow-none">
          <div className="grid grid-cols-3 gap-2 border-b border-white/6 pb-3">
            <TopTab label="New Game" icon={Globe2} active />
            <TopTab label="Games" icon={Grid2x2} />
            <TopTab label="Players" icon={Users} />
          </div>

          <div className="mt-3 rounded-[1rem] border border-[#4b463f] bg-[linear-gradient(180deg,#47433e_0%,#393530_100%)] px-4 py-3">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#3a342d] text-[#8573d8]">
                <User2 className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <h1 className="text-[2.55rem] font-black tracking-tight text-white">Play Chess</h1>
                <p className="mt-1 text-sm text-[#c5baaa]">Choose a mode first. Setup opens on the next screen.</p>
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-2.5">
            <LobbyShortcut
              title="Play Online"
              text="Open matchmaking setup with mode, clock, and time-based rating"
              meta="Queue"
              onClick={() => router.push("/play/online")}
            />
            <LobbyShortcut
              title="Play Bots"
              text="Open bot setup with bot Elo, side, and clock presets"
              meta="Bots"
              onClick={() => router.push("/bot")}
            />
            <LobbyShortcut
              title="Play Local"
              text="Start an instant local game on one device with the default 10+0 clock"
              meta="10+0"
              onClick={() => setLocalMode(true)}
            />
            <LobbyShortcut
              title="Play a Friend"
              text="Create a friend room from the online lobby and share the invite link"
              meta="Link"
              onClick={() => router.push("/play/online")}
            />
            <LobbyShortcut
              title="Learn & Practice"
              text="Lessons, puzzles, and training before your next game"
              onClick={() => router.push("/learn")}
            />
          </div>

          <div className="mt-4 rounded-[0.95rem] border border-[#4b463f] bg-[#2a2723] px-4 py-3 text-sm text-[#d4cab9]">
            Online and bot ratings are handled on their own setup screens. Bullet, blitz, rapid, and classical
            use separate ratings.
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/6 pt-3 text-[#d7ccbb]">
            <Link
              href="/history"
              className="inline-flex items-center gap-2 text-base font-black transition hover:text-white"
            >
              <History className="h-5 w-5" />
              History
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-2 text-base font-black transition hover:text-white"
            >
              <Trophy className="h-5 w-5" />
              Leaderboard
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
}
