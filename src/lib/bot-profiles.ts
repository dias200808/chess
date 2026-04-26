import type { BotDifficulty } from "@/lib/types";

export type BotProfile = {
  id: BotDifficulty;
  name: string;
  elo: number;
  description: string;
  depth: number;
  blunderChance: number;
  mistakeChance: number;
  tacticalBias: number;
  useStockfish: boolean;
  stockfishDepth?: number;
  stockfishMoveTime?: number;
};

export const botProfiles: BotProfile[] = [
  {
    id: "elo-200",
    name: "Pawn Pusher",
    elo: 200,
    description: "Mostly random moves and frequent hanging pieces.",
    depth: 0,
    blunderChance: 0.55,
    mistakeChance: 0.28,
    tacticalBias: 0.05,
    useStockfish: false,
  },
  {
    id: "elo-400",
    name: "Rookie Ranger",
    elo: 400,
    description: "Knows captures exist, but still misses simple threats.",
    depth: 0,
    blunderChance: 0.42,
    mistakeChance: 0.25,
    tacticalBias: 0.15,
    useStockfish: false,
  },
  {
    id: "elo-600",
    name: "Fork Finder",
    elo: 600,
    description: "Looks for checks and captures with plenty of noise.",
    depth: 1,
    blunderChance: 0.3,
    mistakeChance: 0.22,
    tacticalBias: 0.28,
    useStockfish: false,
  },
  {
    id: "elo-800",
    name: "Club Starter",
    elo: 800,
    description: "Avoids the worst one-move blunders but can still drift.",
    depth: 1,
    blunderChance: 0.2,
    mistakeChance: 0.18,
    tacticalBias: 0.35,
    useStockfish: false,
  },
  {
    id: "elo-1000",
    name: "Tactics Trainee",
    elo: 1000,
    description: "One-ply calculation with occasional human mistakes.",
    depth: 2,
    blunderChance: 0.14,
    mistakeChance: 0.14,
    tacticalBias: 0.45,
    useStockfish: false,
  },
  {
    id: "elo-1200",
    name: "Weekend Warrior",
    elo: 1200,
    description: "A balanced bot that sees most immediate captures.",
    depth: 2,
    blunderChance: 0.09,
    mistakeChance: 0.1,
    tacticalBias: 0.55,
    useStockfish: false,
  },
  {
    id: "elo-1400",
    name: "Arena Regular",
    elo: 1400,
    description: "Deeper search and fewer freebies.",
    depth: 3,
    blunderChance: 0.055,
    mistakeChance: 0.075,
    tacticalBias: 0.65,
    useStockfish: false,
  },
  {
    id: "elo-1600",
    name: "Sharp Solver",
    elo: 1600,
    description: "Usually punishes loose pieces and unsafe kings.",
    depth: 3,
    blunderChance: 0.03,
    mistakeChance: 0.05,
    tacticalBias: 0.72,
    useStockfish: false,
  },
  {
    id: "elo-1800",
    name: "Candidate Crusher",
    elo: 1800,
    description: "Strong minimax search with only rare inaccuracies.",
    depth: 4,
    blunderChance: 0.015,
    mistakeChance: 0.035,
    tacticalBias: 0.82,
    useStockfish: false,
  },
  {
    id: "elo-2000",
    name: "Master Mode",
    elo: 2000,
    description: "Deep local search for serious practice.",
    depth: 4,
    blunderChance: 0.006,
    mistakeChance: 0.018,
    tacticalBias: 0.9,
    useStockfish: false,
  },
  {
    id: "elo-2200",
    name: "Stockfish Lite",
    elo: 2200,
    description: "Stockfish-powered moves with short think time.",
    depth: 4,
    blunderChance: 0,
    mistakeChance: 0,
    tacticalBias: 1,
    useStockfish: true,
    stockfishDepth: 8,
    stockfishMoveTime: 450,
  },
  {
    id: "elo-2400",
    name: "National Master",
    elo: 2400,
    description: "Stockfish-powered moves with stronger calculation.",
    depth: 4,
    blunderChance: 0,
    mistakeChance: 0,
    tacticalBias: 1,
    useStockfish: true,
    stockfishDepth: 11,
    stockfishMoveTime: 800,
  },
  {
    id: "stockfish",
    name: "Stockfish Max",
    elo: 3000,
    description: "Best available WASM Stockfish line in this MVP.",
    depth: 4,
    blunderChance: 0,
    mistakeChance: 0,
    tacticalBias: 1,
    useStockfish: true,
    stockfishDepth: 14,
    stockfishMoveTime: 1200,
  },
];

export function getBotProfile(id: BotDifficulty) {
  return botProfiles.find((profile) => profile.id === id) ?? botProfiles[5];
}
