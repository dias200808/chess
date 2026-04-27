"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { ChessboardOptions } from "react-chessboard";
import { cn } from "@/lib/utils";

type ClientChessboardProps = {
  options?: ChessboardOptions;
  className?: string;
};

const DynamicChessboard = dynamic<ClientChessboardProps>(
  () =>
    import("react-chessboard").then(
      (module) => module.Chessboard as ComponentType<ClientChessboardProps>,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-square w-full rounded-[1.3rem] bg-muted/60" />
    ),
  },
);

export function Chessboard({ options, className }: ClientChessboardProps) {
  return (
    <div className={cn("aspect-square w-full overflow-hidden", className)}>
      <DynamicChessboard
        options={{
          ...options,
          boardStyle: {
            width: "100%",
            height: "100%",
            aspectRatio: "1 / 1",
            gap: 0,
            lineHeight: 0,
            ...options?.boardStyle,
          },
          squareStyle: {
            lineHeight: 0,
            ...options?.squareStyle,
          },
        }}
      />
    </div>
  );
}
