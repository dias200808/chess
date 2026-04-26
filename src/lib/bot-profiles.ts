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
    description: "Почти случайные ходы и частые зевки фигур.",
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
    description: "Уже замечает взятия, но все еще пропускает простые угрозы.",
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
    description: "Ищет шахи и взятия, но играет довольно шумно и неровно.",
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
    description: "Избегает самых грубых зевков в один ход, но все еще ошибается.",
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
    description: "Считает на один ход вперед и иногда ошибается по-человечески.",
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
    description: "Сбалансированный бот, замечает большинство прямых взятий.",
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
    description: "Считает глубже и почти не дарит фигуры просто так.",
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
    description: "Обычно наказывает за висящие фигуры и слабого короля.",
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
    description: "Сильный minimax-поиск с очень редкими неточностями.",
    depth: 5,
    blunderChance: 0.015,
    mistakeChance: 0.035,
    tacticalBias: 0.82,
    useStockfish: false,
  },
  {
    id: "elo-2000",
    name: "Master Mode",
    elo: 2000,
    description: "Глубокий локальный поиск для серьезной тренировки.",
    depth: 5,
    blunderChance: 0.006,
    mistakeChance: 0.018,
    tacticalBias: 0.9,
    useStockfish: false,
  },
  {
    id: "elo-2200",
    name: "Stockfish Lite",
    elo: 2200,
    description: "Ходы на базе Stockfish с коротким временем на обдумывание.",
    depth: 6,
    blunderChance: 0,
    mistakeChance: 0,
    tacticalBias: 1,
    useStockfish: true,
    stockfishDepth: 10,
    stockfishMoveTime: 700,
  },
  {
    id: "elo-2400",
    name: "National Master",
    elo: 2400,
    description: "Stockfish-режим с более сильным расчетом.",
    depth: 6,
    blunderChance: 0,
    mistakeChance: 0,
    tacticalBias: 1,
    useStockfish: true,
    stockfishDepth: 13,
    stockfishMoveTime: 1200,
  },
  {
    id: "stockfish",
    name: "Stockfish Max",
    elo: 3000,
    description: "Максимально сильная WASM-версия Stockfish в этом MVP.",
    depth: 7,
    blunderChance: 0,
    mistakeChance: 0,
    tacticalBias: 1,
    useStockfish: true,
    stockfishDepth: 18,
    stockfishMoveTime: 2500,
  },
];

export function getBotProfile(id: BotDifficulty) {
  return botProfiles.find((profile) => profile.id === id) ?? botProfiles[5];
}
