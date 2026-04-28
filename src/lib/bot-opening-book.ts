import { Chess, type Move } from "chess.js";
import type { BotProfile } from "@/lib/bot-profiles";

type OpeningLine = {
  name: string;
  style: BotProfile["openingStyle"] | "any";
  moves: string[];
};

const openingLines: OpeningLine[] = [
  { name: "Italian Game", style: "open", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5"] },
  { name: "Scotch Game", style: "open", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "d2d4", "e5d4"] },
  { name: "Queen's Gambit Declined", style: "solid", moves: ["d2d4", "d7d5", "c2c4", "e7e6", "b1c3", "g8f6"] },
  { name: "London System", style: "solid", moves: ["d2d4", "d7d5", "c1f4", "g8f6", "e2e3", "c7c5"] },
  { name: "Ruy Lopez", style: "classical", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6"] },
  { name: "Slav Defence", style: "classical", moves: ["d2d4", "d7d5", "c2c4", "c7c6", "g1f3", "g8f6"] },
  { name: "Danish Gambit", style: "gambit", moves: ["e2e4", "e7e5", "d2d4", "e5d4", "c2c3", "d4c3"] },
  { name: "King's Gambit Accepted", style: "gambit", moves: ["e2e4", "e7e5", "f2f4", "e5f4", "g1f3", "g7g5"] },
];

function moveToUci(move: Move) {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function matchesHistory(line: OpeningLine, history: string[]) {
  if (history.length >= line.moves.length) return false;
  return history.every((move, index) => move === line.moves[index]);
}

export function chooseOpeningBookMove(fen: string, history: string[], profile: BotProfile) {
  const candidates = openingLines.filter(
    (line) => (line.style === "any" || line.style === profile.openingStyle || profile.openingStyle === "universal") && matchesHistory(line, history),
  );
  if (!candidates.length) return null;

  const line = candidates[Math.floor(Math.random() * candidates.length)];
  const nextUci = line.moves[history.length];
  if (!nextUci) return null;

  const chess = new Chess(fen);
  return chess
    .moves({ verbose: true })
    .find((move) => moveToUci(move) === nextUci || `${move.from}${move.to}` === nextUci) ?? null;
}
