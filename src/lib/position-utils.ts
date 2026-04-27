export type BoardPosition = Record<string, { pieceType: string }>;

export const EMPTY_POSITION: BoardPosition = {};

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const pieceToFen: Record<string, string> = {
  wP: "P",
  wN: "N",
  wB: "B",
  wR: "R",
  wQ: "Q",
  wK: "K",
  bP: "p",
  bN: "n",
  bB: "b",
  bR: "r",
  bQ: "q",
  bK: "k",
};
const fenToPiece = Object.fromEntries(Object.entries(pieceToFen).map(([piece, fen]) => [fen, piece]));

export function fenToPosition(fen: string): BoardPosition {
  const board = fen.trim().split(/\s+/)[0];
  const rows = board.split("/");
  if (rows.length !== 8) throw new Error("FEN must have 8 ranks.");
  const position: BoardPosition = {};

  rows.forEach((rankValue, rankIndex) => {
    let fileIndex = 0;
    for (const char of rankValue) {
      if (/\d/.test(char)) {
        fileIndex += Number(char);
        continue;
      }
      const pieceType = fenToPiece[char];
      if (!pieceType || fileIndex > 7) throw new Error("Invalid FEN piece placement.");
      const square = `${files[fileIndex]}${8 - rankIndex}`;
      position[square] = { pieceType };
      fileIndex += 1;
    }
    if (fileIndex !== 8) throw new Error("Each FEN rank must contain 8 files.");
  });

  return position;
}

export function positionToFen({
  position,
  turn = "w",
  castling = "-",
  enPassant = "-",
  halfmove = 0,
  fullmove = 1,
}: {
  position: BoardPosition;
  turn?: "w" | "b";
  castling?: string;
  enPassant?: string;
  halfmove?: number;
  fullmove?: number;
}) {
  const ranks: string[] = [];
  for (let rank = 8; rank >= 1; rank -= 1) {
    let row = "";
    let empty = 0;
    for (const file of files) {
      const piece = position[`${file}${rank}`]?.pieceType;
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty) {
        row += empty;
        empty = 0;
      }
      row += pieceToFen[piece] ?? "1";
    }
    if (empty) row += empty;
    ranks.push(row);
  }

  return `${ranks.join("/")} ${turn} ${castling || "-"} ${enPassant || "-"} ${halfmove} ${fullmove}`;
}

export function normalizeFenInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("FEN is empty.");
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return `${parts[0]} w - - 0 1`;
  return trimmed;
}

export function isValidEnPassant(value: string) {
  return value === "-" || /^[a-h][36]$/.test(value);
}
