import type { TimeControl } from "@/lib/types";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

export const timeControlPresets: TimeControl[] = [
  { id: "bullet", label: "1+0", initialSeconds: 60, incrementSeconds: 0 },
  { id: "blitz", label: "3+2", initialSeconds: 180, incrementSeconds: 2 },
  { id: "rapid", label: "10+0", initialSeconds: 600, incrementSeconds: 0 },
  { id: "rapid_inc", label: "15+10", initialSeconds: 900, incrementSeconds: 10 },
  { id: "classical", label: "30+0", initialSeconds: 1800, incrementSeconds: 0 },
  { id: "unlimited", label: "Без лимита", initialSeconds: null, incrementSeconds: 0 },
];

export function getTimeControlPreset(id: string) {
  return timeControlPresets.find((item) => item.id === id) ?? timeControlPresets[2];
}

export function describeTimeControl(timeControl: TimeControl) {
  if (timeControl.initialSeconds === null) return "Без лимита времени";
  if (timeControl.incrementSeconds === 0) return `${timeControl.label} без добавления`;
  return `${timeControl.label} с добавлением ${timeControl.incrementSeconds} сек`;
}
