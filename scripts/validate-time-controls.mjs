import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const config = readFileSync(new URL("../src/lib/game-config.ts", import.meta.url), "utf8");
const presets = Array.from(
  config.matchAll(
    /label:\s*"([^"]+)",\s*initialSeconds:\s*(null|\d+),\s*incrementSeconds:\s*(\d+)/g,
  ),
).map((match) => ({
  label: match[1],
  initialSeconds: match[2] === "null" ? null : Number(match[2]),
  incrementSeconds: Number(match[3]),
}));

const requiredLabels = [
  "No time",
  "1+0",
  "1+1",
  "3+0",
  "3+2",
  "5+0",
  "5+3",
  "10+0",
  "10+5",
  "15+10",
  "30+0",
];

assert.deepEqual(
  presets.map((item) => item.label),
  requiredLabels,
  "all required time controls exist in order",
);

function makeClock(preset) {
  if (preset.initialSeconds === null) return null;
  return {
    white: preset.initialSeconds * 1000,
    black: preset.initialSeconds * 1000,
    turn: "white",
    gameOver: false,
  };
}

function tick(clock, ms) {
  if (!clock || clock.gameOver) return clock;
  const next = { ...clock, [clock.turn]: Math.max(0, clock[clock.turn] - ms) };
  if (next[next.turn] <= 0) next.gameOver = true;
  return next;
}

function move(clock, preset) {
  if (!clock || clock.gameOver) return clock;
  const side = clock.turn;
  return {
    ...clock,
    [side]: clock[side] + preset.incrementSeconds * 1000,
    turn: side === "white" ? "black" : "white",
  };
}

const blitz = presets.find((item) => item.label === "3+2");
let clock = makeClock(blitz);
clock = tick(clock, 10_000);
assert.equal(clock.white, 170_000, "only side to move loses time");
assert.equal(clock.black, 180_000, "opponent clock does not run");
clock = move(clock, blitz);
assert.equal(clock.white, 172_000, "increment is added after move");
assert.equal(clock.turn, "black", "clock switches after move");
clock = tick(clock, 180_000);
assert.equal(clock.gameOver, true, "flag ends the game");
const flaggedBlackTime = clock.black;
clock = move(clock, blitz);
clock = tick(clock, 10_000);
assert.equal(clock.black, flaggedBlackTime, "clock stays stopped after flag");
assert.equal(makeClock(presets[0]), null, "no time disables clocks");

console.log("Time controls validation passed.");
