import { Chess, SQUARES } from "chess.js";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(process.cwd(), "src/lib/data.ts"), "utf8");
const puzzlePattern =
  /id: "([^"]+)"[\s\S]*?category: "([^"]+)"[\s\S]*?fen: "([^"]+)"[\s\S]*?bestMove: "([^"]+)"([\s\S]*?)(?=\n  \{|\n\];)/g;

function kingSquare(chess, color) {
  return SQUARES.find((square) => {
    const piece = chess.get(square);
    return piece?.type === "k" && piece.color === color;
  });
}

let failed = 0;
let match;

while ((match = puzzlePattern.exec(source))) {
  const [, id, category, fen, bestMove, rest] = match;
  const lineMatch = /line: \[([^\]]+)\]/.exec(rest);
  const line = lineMatch
    ? [...lineMatch[1].matchAll(/"([^"]+)"/g)].map((item) => item[1])
    : [bestMove];

  try {
    const chess = new Chess(fen);
    const turn = chess.turn();
    const opponent = turn === "w" ? "b" : "w";
    const opponentKing = kingSquare(chess, opponent);

    if (opponentKing && chess.isAttacked(opponentKing, turn)) {
      throw new Error("opponent king is already in check before the puzzle starts");
    }

    for (const uci of line) {
      const targetPiece = chess.get(uci.slice(2, 4));
      if (targetPiece?.type === "k") {
        throw new Error(`solution tries to capture a king with ${uci}`);
      }

      chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4] || "q",
      });
    }

    if (category === "mate in 1" || category === "mate in 2") {
      if (!chess.isCheckmate()) {
        throw new Error(`${id} is labeled as mate puzzle, but the solution line does not end in checkmate`);
      }
    }

    console.log(`OK ${id}: ${line.join(" ")}`);
  } catch (error) {
    failed += 1;
    console.error(`INVALID ${id}: ${error.message}`);
  }
}

if (failed) {
  process.exit(1);
}
