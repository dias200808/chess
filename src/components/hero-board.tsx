"use client";

import { User2 } from "lucide-react";
import { Chessboard } from "@/components/client-chessboard";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function PlayerRow({
  name,
  subtitle,
  tone = "dark",
}: {
  name: string;
  subtitle?: string;
  tone?: "dark" | "light";
}) {
  const dark = tone === "dark";

  return (
    <div className="flex items-center gap-3 px-1">
      <div
        className={`grid h-12 w-12 place-items-center rounded-md border ${
          dark
            ? "border-white/8 bg-[#4b463f] text-[#d9d2c4]"
            : "border-black/10 bg-[#f2ede2] text-[#6f6554]"
        }`}
      >
        <User2 className="h-7 w-7" />
      </div>
      <div className="min-w-0">
        <p className={`truncate text-2xl font-black ${dark ? "text-white" : "text-[#fff7eb]"}`}>{name}</p>
        {subtitle ? (
          <p className={`text-sm ${dark ? "text-[#b7af9f]" : "text-[#d9cfbc]"}`}>{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

export function HeroBoard() {
  return (
    <section className="rounded-[1.35rem] border border-[#4a453f] bg-[#2c2926] p-4 shadow-[0_22px_60px_rgba(0,0,0,0.28)]">
      <PlayerRow name="Opponent" subtitle="Waiting for a game" tone="dark" />

      <div className="mt-4 overflow-hidden rounded-sm">
        <Chessboard
          options={{
            id: "knightly-play-lobby-board",
            position: START_FEN,
            allowDragging: false,
            showNotation: true,
            showAnimations: false,
            boardStyle: {
              overflow: "hidden",
            },
            lightSquareStyle: { backgroundColor: "#eeeed2" },
            darkSquareStyle: { backgroundColor: "#769656" },
            alphaNotationStyle: { color: "#d7d772", fontWeight: 800, fontSize: "1.15rem" },
            numericNotationStyle: { color: "#d7d772", fontWeight: 800, fontSize: "1.15rem" },
          }}
        />
      </div>

      <div className="mt-4">
        <PlayerRow name="Player" subtitle="Choose a mode on the right" tone="light" />
      </div>
    </section>
  );
}
