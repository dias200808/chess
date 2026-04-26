"use client";

import { Chessboard } from "@/components/client-chessboard";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

export function HeroBoard() {
  return (
    <div className="mx-auto aspect-square w-full max-w-[560px] overflow-hidden rounded-3xl border shadow-2xl shadow-black/25">
      <Chessboard
        options={{
          id: "knightly-hero-board",
          position: START_FEN,
          allowDragging: false,
          showNotation: false,
          showAnimations: false,
          boardStyle: {
            borderRadius: "1.5rem",
            overflow: "hidden",
          },
          lightSquareStyle: { backgroundColor: "#ecd8ad" },
          darkSquareStyle: { backgroundColor: "#557a4a" },
        }}
      />
    </div>
  );
}
