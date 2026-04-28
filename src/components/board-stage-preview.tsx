"use client";

import { Chessboard } from "@/components/client-chessboard";
import { Badge } from "@/components/ui";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function BoardStagePreview({
  topLabel,
  bottomLabel,
  topMeta,
  bottomMeta,
  orientation = "white",
}: {
  topLabel: string;
  bottomLabel: string;
  topMeta?: string;
  bottomMeta?: string;
  orientation?: "white" | "black";
}) {
  return (
    <section className="grid gap-3 rounded-[1.75rem] border bg-[#2b2926] p-4 text-[#f7f2e7] shadow-2xl shadow-black/20 lg:p-5">
      <div className="flex items-center gap-3 rounded-2xl bg-black/12 px-3 py-2">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#403d39] text-sm font-black text-[#f7f2e7]">
          {initials(topLabel)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-black">{topLabel}</p>
          {topMeta ? <p className="text-sm text-[#cfc7b7]">{topMeta}</p> : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.3rem] border border-black/20 shadow-[0_16px_60px_rgba(0,0,0,0.28)]">
        <Chessboard
          options={{
            id: `stage-preview-${topLabel}-${bottomLabel}`,
            position: START_FEN,
            boardOrientation: orientation,
            allowDragging: false,
            showNotation: true,
            showAnimations: false,
            boardStyle: {
              overflow: "hidden",
            },
            lightSquareStyle: { backgroundColor: "#eeeed2" },
            darkSquareStyle: { backgroundColor: "#769656" },
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl bg-black/12 px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#e6e4df] text-sm font-black text-[#1f1c18]">
            {initials(bottomLabel)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-[#f7f2e7]">{bottomLabel}</p>
            {bottomMeta ? <p className="text-sm text-[#cfc7b7]">{bottomMeta}</p> : null}
          </div>
        </div>
        <Badge className="border-[#5f8443] bg-[#4d6a36] text-[#f7f2e7]">Starting position</Badge>
      </div>
    </section>
  );
}
