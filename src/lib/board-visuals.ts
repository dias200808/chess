import type { ChessSettings } from "@/lib/types";

export const boardThemes: Record<ChessSettings["boardStyle"], { light: string; dark: string }> = {
  forest: { light: "#e8d4aa", dark: "#58764a" },
  sand: { light: "#f0dfbc", dark: "#b78956" },
  classic: { light: "#f0d9b5", dark: "#b58863" },
  blue: { light: "#d8e4f2", dark: "#557da3" },
  mono: { light: "#e6e4df", dark: "#6c6a64" },
};

export function boardColors(settings: Pick<ChessSettings, "boardStyle">) {
  return boardThemes[settings.boardStyle] ?? boardThemes.forest;
}

export function backgroundClass(theme: ChessSettings["backgroundTheme"]) {
  switch (theme) {
    case "plain":
      return "bg-[#24221f]";
    case "wood":
      return "bg-[#2a2119]";
    case "midnight":
      return "bg-[#151923]";
    default:
      return "bg-[#24221f]";
  }
}

export function animationDuration(settings: Pick<ChessSettings, "animationSpeed">) {
  return Math.max(0, Math.min(600, settings.animationSpeed));
}
