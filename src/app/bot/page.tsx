"use client";

import { useState } from "react";
import { ChessGame } from "@/components/chess-game";
import { Badge, Card, SelectField } from "@/components/ui";
import { botProfiles, getBotProfile } from "@/lib/bot-profiles";
import type { BotDifficulty } from "@/lib/types";

export default function BotPage() {
  const [colorChoice, setColorChoice] = useState<"white" | "black" | "random">("white");
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [difficulty, setDifficulty] = useState<BotDifficulty>("elo-800");
  const profile = getBotProfile(difficulty);

  function chooseColor(value: "white" | "black" | "random") {
    setColorChoice(value);
    setPlayerColor(value === "random" ? (crypto.getRandomValues(new Uint8Array(1))[0] > 127 ? "white" : "black") : value);
  }

  return (
    <div className="grid gap-6">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge>Computer mode</Badge>
            <h1 className="mt-2 text-3xl font-black">Play against the Knightly bot</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Choose Chess.com-style Elo bots from 200 to 2400, or switch to Stockfish Max.
              Lower bots make human-like mistakes; stronger bots calculate deeper.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
            <SelectField
              label="Your color"
              value={colorChoice}
              onChange={(event) => chooseColor(event.target.value as typeof colorChoice)}
            >
              <option value="white">White</option>
              <option value="black">Black</option>
              <option value="random">Random</option>
            </SelectField>
            <SelectField
              label="Difficulty"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value as BotDifficulty)}
            >
              {botProfiles.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.elo} - {bot.name}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border bg-muted p-4 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{profile.name}:</span>{" "}
          {profile.description}
        </div>
      </Card>
      <ChessGame key={`${playerColor}-${difficulty}`} mode="bot" playerColor={playerColor} difficulty={difficulty} />
    </div>
  );
}
