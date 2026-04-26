"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { ChessboardOptions } from "react-chessboard";

type ClientChessboardProps = {
  options?: ChessboardOptions;
};

export const Chessboard = dynamic<ClientChessboardProps>(
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
