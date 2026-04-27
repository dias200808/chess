import type { TimeControl } from "@/lib/types";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

export const timeControlPresets: TimeControl[] = [
  { id: "no-time", label: "No time", initialSeconds: null, incrementSeconds: 0 },
  { id: "1-0", label: "1+0", initialSeconds: 60, incrementSeconds: 0 },
  { id: "1-1", label: "1+1", initialSeconds: 60, incrementSeconds: 1 },
  { id: "3-0", label: "3+0", initialSeconds: 180, incrementSeconds: 0 },
  { id: "3-2", label: "3+2", initialSeconds: 180, incrementSeconds: 2 },
  { id: "5-0", label: "5+0", initialSeconds: 300, incrementSeconds: 0 },
  { id: "5-3", label: "5+3", initialSeconds: 300, incrementSeconds: 3 },
  { id: "10-0", label: "10+0", initialSeconds: 600, incrementSeconds: 0 },
  { id: "10-5", label: "10+5", initialSeconds: 600, incrementSeconds: 5 },
  { id: "15-10", label: "15+10", initialSeconds: 900, incrementSeconds: 10 },
  { id: "30-0", label: "30+0", initialSeconds: 1800, incrementSeconds: 0 },
];

export function getTimeControlPreset(id: string) {
  return timeControlPresets.find((item) => item.id === id) ?? timeControlPresets[7];
}

export function describeTimeControl(timeControl: TimeControl) {
  if (timeControl.initialSeconds === null) return "Без лимита времени";
  if (timeControl.incrementSeconds === 0) return `${timeControl.label} без добавления`;
  return `${timeControl.label} с добавлением ${timeControl.incrementSeconds} сек`;
}
