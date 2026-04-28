import fs from "node:fs";
import path from "node:path";

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function titleFor(themes) {
  if (themes.includes("mateIn1")) return "Lichess Mate in 1";
  if (themes.includes("mateIn2")) return "Lichess Mate in 2";
  if (themes.includes("fork")) return "Lichess Fork";
  if (themes.includes("pin")) return "Lichess Pin";
  if (themes.includes("skewer")) return "Lichess Skewer";
  if (themes.includes("promotion")) return "Lichess Promotion";
  return "Lichess Puzzle";
}

function categoryFor(themes) {
  if (themes.includes("mateIn1")) return "mate in 1";
  if (themes.includes("mateIn2")) return "mate in 2";
  if (themes.includes("mateIn3")) return "mate in 3";
  if (themes.includes("fork")) return "fork";
  if (themes.includes("pin")) return "pin";
  if (themes.includes("skewer")) return "skewer";
  if (themes.includes("discoveredAttack")) return "discovered attack";
  if (themes.includes("doubleAttack")) return "double attack";
  if (themes.includes("backRankMate")) return "back rank mate";
  if (themes.includes("hangingPiece")) return "hanging piece";
  if (themes.includes("promotion")) return "promotion";
  if (themes.includes("sacrifice")) return "sacrifice";
  if (themes.includes("defensiveMove")) return "defense";
  if (themes.includes("opening")) return "opening trap";
  if (themes.includes("deflection")) return "deflection";
  if (themes.includes("clearance")) return "clearance";
  if (themes.includes("endgame")) return "endgame";
  return "winning material";
}

function normalizedThemes(themes) {
  const mapped = [
    themes.includes("mateIn1") ? "mate in 1" : null,
    themes.includes("mateIn2") ? "mate in 2" : null,
    themes.includes("mateIn3") ? "mate in 3" : null,
    themes.includes("fork") ? "fork" : null,
    themes.includes("pin") ? "pin" : null,
    themes.includes("skewer") ? "skewer" : null,
    themes.includes("discoveredAttack") ? "discovered attack" : null,
    themes.includes("doubleAttack") ? "double attack" : null,
    themes.includes("backRankMate") ? "back rank mate" : null,
    themes.includes("hangingPiece") ? "hanging piece" : null,
    themes.includes("endgame") ? "endgame" : null,
    themes.includes("promotion") ? "promotion" : null,
    themes.includes("sacrifice") ? "sacrifice" : null,
    themes.includes("defensiveMove") ? "defense" : null,
    themes.includes("opening") ? "opening trap" : null,
    themes.includes("deflection") ? "deflection" : null,
    themes.includes("clearance") ? "clearance" : null,
    themes.includes("advantage") ? "winning material" : null,
  ].filter(Boolean);

  return [...new Set(mapped)];
}

function difficultyFor(rating) {
  if (rating < 1200) return "easy";
  if (rating < 1600) return "medium";
  if (rating < 2000) return "hard";
  return "expert";
}

const csvPath = process.argv[2];
const outputPath = process.argv[3] ?? path.join(process.cwd(), "src/lib/generated/lichess-puzzles.ts");
const maxRows = Number(process.argv[4] ?? 5000);

if (!csvPath) {
  console.error("Usage: node scripts/import-lichess-puzzles.mjs <lichess-csv> [output-ts] [maxRows]");
  process.exit(1);
}

const source = fs.readFileSync(csvPath, "utf8");
const lines = source.split(/\r?\n/).filter(Boolean);
const header = parseCsvLine(lines[0]);
const rows = [];

for (let index = 1; index < lines.length && rows.length < maxRows; index += 1) {
  const values = parseCsvLine(lines[index]);
  const row = Object.fromEntries(header.map((key, headerIndex) => [key, values[headerIndex] ?? ""]));
  const themes = String(row.Themes ?? "")
    .split(" ")
    .map((item) => item.trim())
    .filter(Boolean);
  const moves = String(row.Moves ?? "")
    .split(" ")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!row.PuzzleId || !row.FEN || !moves.length) continue;

  const category = categoryFor(themes);
  const normalized = normalizedThemes(themes);
  rows.push({
    id: String(row.PuzzleId),
    externalId: String(row.PuzzleId),
    category,
    title: titleFor(themes),
    fen: String(row.FEN),
    bestMove: moves[0],
    line: moves,
    sideToMove: String(row.FEN).split(" ")[1] === "b" ? "black" : "white",
    explanation: `Imported from Lichess puzzle database. Main idea: ${normalized.join(", ") || category}.`,
    hint: normalized[0] ? `Look for a ${normalized[0]} idea.` : "Find the forcing tactic.",
    rating: Number(row.Rating ?? 1500),
    points: Math.max(12, Math.round(Number(row.Rating ?? 1500) / 80)),
    difficulty: difficultyFor(Number(row.Rating ?? 1500)),
    themes: normalized.length ? normalized : [category],
    opening: row.OpeningTags ? String(row.OpeningTags) : undefined,
    sourceGame: row.GameUrl ? String(row.GameUrl) : undefined,
    popularity: row.Popularity ? Number(row.Popularity) : undefined,
    playsCount: row.NbPlays ? Number(row.NbPlays) : undefined,
    winPercentage: row.Played ? undefined : undefined,
  });
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `import type { Puzzle } from "@/lib/types";\n\nexport const lichessPuzzles: Puzzle[] = ${JSON.stringify(rows, null, 2)};\n`,
);

console.log(`Imported ${rows.length} puzzles into ${outputPath}`);
