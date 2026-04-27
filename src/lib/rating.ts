import type { GameMode, RatingType, TimeControl, UserProfile } from "@/lib/types";

export const STARTING_RATING = 1200;
const K_FACTOR = 24;

export const ratingTypeLabels: Record<RatingType | "overall", string> = {
  overall: "Overall",
  bullet: "Bullet",
  blitz: "Blitz",
  rapid: "Rapid",
  classical: "Classical",
  puzzle: "Puzzle",
};

export function ratingField(type: RatingType | "overall") {
  switch (type) {
    case "bullet":
      return "bulletRating";
    case "blitz":
      return "blitzRating";
    case "rapid":
      return "rapidRating";
    case "classical":
      return "classicalRating";
    case "puzzle":
      return "puzzleRating";
    default:
      return "rating";
  }
}

export function ratingForProfile(profile: UserProfile, type: RatingType | "overall") {
  const value = profile[ratingField(type)];
  return Number.isFinite(value) ? value : STARTING_RATING;
}

export function ratingTypeForTimeControl(timeControl: TimeControl): RatingType | null {
  if (timeControl.initialSeconds === null) return null;
  if (timeControl.initialSeconds <= 120) return "bullet";
  if (timeControl.initialSeconds <= 300) return "blitz";
  if (timeControl.initialSeconds <= 900) return "rapid";
  return "classical";
}

export function isRatedGame(mode: GameMode, timeControl: TimeControl) {
  return mode !== "local" && ratingTypeForTimeControl(timeControl) !== null;
}

export function calculateRatingChange({
  playerRating,
  opponentRating,
  score,
}: {
  playerRating: number;
  opponentRating: number;
  score: 0 | 0.5 | 1;
}) {
  const expected = 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
  return Math.round(K_FACTOR * (score - expected));
}

export function ratingPatch(profile: UserProfile, type: RatingType, nextRating: number) {
  const field = ratingField(type);
  return {
    bulletRating: profile.bulletRating ?? STARTING_RATING,
    blitzRating: profile.blitzRating ?? STARTING_RATING,
    rapidRating: profile.rapidRating ?? STARTING_RATING,
    classicalRating: profile.classicalRating ?? STARTING_RATING,
    puzzleRating: profile.puzzleRating ?? STARTING_RATING,
    rating: nextRating,
    [field]: nextRating,
  };
}
