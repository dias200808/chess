"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Chess } from "chess.js";
import { Activity, Eraser, RotateCcw, Search, Trash2 } from "lucide-react";
import { Chessboard } from "@/components/client-chessboard";
import { Badge, Button, Card, Field, SelectField } from "@/components/ui";
import { animationDuration, boardColors } from "@/lib/board-visuals";
import { START_FEN } from "@/lib/game-config";
import { getSettings } from "@/lib/storage";
import { getStockfishBestMove, type StockfishResult } from "@/lib/stockfish-client";
import {
  EMPTY_POSITION,
  fenToPosition,
  isValidEnPassant,
  normalizeFenInput,
  positionToFen,
  type BoardPosition,
} from "@/lib/position-utils";
import { cn } from "@/lib/utils";

const palette = [
  ["wK", "♔"], ["wQ", "♕"], ["wR", "♖"], ["wB", "♗"], ["wN", "♘"], ["wP", "♙"],
  ["bK", "♚"], ["bQ", "♛"], ["bR", "♜"], ["bB", "♝"], ["bN", "♞"], ["bP", "♟"],
] as const;

function parseFenMeta(fen: string) {
  const parts = normalizeFenInput(fen).split(/\s+/);
  return {
    turn: (parts[1] === "b" ? "b" : "w") as "w" | "b",
    castling: parts[2] && parts[2] !== "-" ? parts[2] : "",
    enPassant: parts[3] ?? "-",
  };
}

function stockfishText(result: StockfishResult | null) {
  if (!result) return "No analysis yet.";
  if (typeof result.mate === "number") return `${result.bestMoveSan ?? result.bestMove} · mate ${result.mate}`;
  if (typeof result.scoreCp === "number") {
    const pawns = result.scoreCp / 100;
    return `${result.bestMoveSan ?? result.bestMove} · ${pawns > 0 ? "+" : ""}${pawns.toFixed(2)}`;
  }
  return result.bestMoveSan ?? result.bestMove;
}

function BoardEditorInner() {
  const router = useRouter();
  const params = useSearchParams();
  const settings = getSettings();
  const colors = boardColors(settings);
  const initialFen = params.get("fen") ?? START_FEN;
  const initialMeta = useMemo(() => parseFenMeta(initialFen), [initialFen]);
  const [position, setPosition] = useState<BoardPosition>(() => {
    try {
      return fenToPosition(normalizeFenInput(initialFen));
    } catch {
      return fenToPosition(START_FEN);
    }
  });
  const [selectedPiece, setSelectedPiece] = useState<string>("wQ");
  const [turn, setTurn] = useState<"w" | "b">(initialMeta.turn);
  const [castling, setCastling] = useState(initialMeta.castling);
  const [enPassant, setEnPassant] = useState(initialMeta.enPassant);
  const [fenText, setFenText] = useState(() =>
    positionToFen({
      position: (() => {
        try {
          return fenToPosition(normalizeFenInput(initialFen));
        } catch {
          return fenToPosition(START_FEN);
        }
      })(),
      turn: initialMeta.turn,
      castling: initialMeta.castling || "-",
      enPassant: initialMeta.enPassant,
    }),
  );
  const [message, setMessage] = useState("Choose a piece, then click a square. Use erase to remove pieces.");
  const [engineResult, setEngineResult] = useState<StockfishResult | null>(null);
  const [thinking, setThinking] = useState(false);

  function currentFen() {
    return positionToFen({
      position,
      turn,
      castling: castling || "-",
      enPassant: enPassant || "-",
    });
  }

  function refreshFen(nextPosition = position) {
    const fen = positionToFen({
      position: nextPosition,
      turn,
      castling: castling || "-",
      enPassant: enPassant || "-",
    });
    setFenText(fen);
    return fen;
  }

  function place(square: string) {
    const next = { ...position };
    if (selectedPiece === "erase") delete next[square];
    else next[square] = { pieceType: selectedPiece };
    setPosition(next);
    refreshFen(next);
  }

  function loadFen() {
    try {
      const normalized = normalizeFenInput(fenText);
      const meta = parseFenMeta(normalized);
      const next = fenToPosition(normalized);
      setPosition(next);
      setTurn(meta.turn);
      setCastling(meta.castling);
      setEnPassant(meta.enPassant);
      setMessage("FEN loaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid FEN.");
    }
  }

  function clearBoard() {
    setPosition(EMPTY_POSITION);
    setFenText(positionToFen({ position: EMPTY_POSITION, turn, castling: "-", enPassant: "-" }));
    setCastling("");
    setEnPassant("-");
    setMessage("Board cleared.");
  }

  function startPosition() {
    const next = fenToPosition(START_FEN);
    setPosition(next);
    setTurn("w");
    setCastling("KQkq");
    setEnPassant("-");
    setFenText(START_FEN);
    setMessage("Starting position restored.");
  }

  async function analyzePosition() {
    const fen = refreshFen();
    try {
      new Chess(fen);
    } catch {
      setMessage("Add both kings and make a legal FEN before analysis.");
      return;
    }
    setThinking(true);
    setMessage("Stockfish is analyzing the edited position...");
    try {
      const result = await getStockfishBestMove(fen, { depth: 13, moveTime: 900, timeout: 12000 });
      setEngineResult(result);
      setMessage(result ? `Best move: ${stockfishText(result)}` : "Stockfish did not return a move.");
    } finally {
      setThinking(false);
    }
  }

  function updateCastling(right: string, checked: boolean) {
    const next = checked
      ? Array.from(new Set(`${castling}${right}`.split(""))).join("")
      : castling.replace(right, "");
    const ordered = "KQkq".split("").filter((item) => next.includes(item)).join("");
    setCastling(ordered);
    setFenText(positionToFen({ position, turn, castling: ordered || "-", enPassant }));
  }

  function updateTurn(nextTurn: "w" | "b") {
    setTurn(nextTurn);
    setFenText(positionToFen({ position, turn: nextTurn, castling: castling || "-", enPassant }));
  }

  function updateEnPassant(value: string) {
    setEnPassant(value);
    if (isValidEnPassant(value)) {
      setFenText(positionToFen({ position, turn, castling: castling || "-", enPassant: value }));
    }
  }

  const bestMoveSquares =
    engineResult?.bestMove && engineResult.bestMove.length >= 4
      ? [engineResult.bestMove.slice(0, 2), engineResult.bestMove.slice(2, 4)]
      : [];
  const squareStyles = Object.fromEntries(
    bestMoveSquares.map((square) => [
      square,
      { background: "radial-gradient(circle, rgba(96, 197, 141, 0.65) 34%, transparent 38%)" },
    ]),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_28rem]">
      <Card className="p-3 sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <Badge>Board editor</Badge>
            <h1 className="mt-2 text-3xl font-black">Position Editor</h1>
          </div>
          <Badge>{turn === "w" ? "White to move" : "Black to move"}</Badge>
        </div>
        <div className="mx-auto max-w-[min(82vh,760px)]">
          <Chessboard
            options={{
              position,
              boardOrientation: turn === "w" ? "white" : "black",
              allowDragging: true,
              allowDrawingArrows: true,
              clearArrowsOnClick: false,
              onSquareClick: ({ square }) => place(square),
              onPieceDrop: ({ piece, sourceSquare, targetSquare }) => {
                if (!targetSquare) return false;
                const next = { ...position };
                delete next[sourceSquare];
                next[targetSquare] = { pieceType: piece.pieceType };
                setPosition(next);
                refreshFen(next);
                return true;
              },
              squareStyles,
              showNotation: settings.boardCoordinates,
              showAnimations: settings.animationSpeed > 0,
              animationDurationInMs: animationDuration(settings),
              boardStyle: {
                borderRadius: "1.5rem",
                boxShadow: "0 24px 80px rgba(0,0,0,0.22)",
                overflow: "hidden",
              },
              lightSquareStyle: { backgroundColor: colors.light },
              darkSquareStyle: { backgroundColor: colors.dark },
            }}
          />
        </div>
      </Card>

      <aside className="grid gap-4 content-start">
        <Card>
          <h2 className="text-xl font-black">Pieces</h2>
          <div className="mt-4 grid grid-cols-6 gap-2">
            {palette.map(([piece, label]) => (
              <button
                key={piece}
                className={cn(
                  "grid h-12 place-items-center rounded-2xl border bg-muted text-2xl transition hover:-translate-y-0.5",
                  selectedPiece === piece && "border-primary bg-primary/20",
                )}
                onClick={() => setSelectedPiece(piece)}
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            className="mt-3 w-full"
            variant={selectedPiece === "erase" ? "primary" : "secondary"}
            onClick={() => setSelectedPiece("erase")}
          >
            <Eraser className="mr-2 h-4 w-4" />
            Erase piece
          </Button>
        </Card>

        <Card>
          <h2 className="text-xl font-black">FEN controls</h2>
          <div className="mt-4 grid gap-3">
            <SelectField label="Side to move" value={turn} onChange={(event) => updateTurn(event.target.value as "w" | "b")}>
              <option value="w">White</option>
              <option value="b">Black</option>
            </SelectField>
            <Field label="En passant square" value={enPassant} onChange={(event) => updateEnPassant(event.target.value)} />
            <div className="grid grid-cols-4 gap-2 text-sm">
              {["K", "Q", "k", "q"].map((right) => (
                <label key={right} className="flex items-center justify-center gap-2 rounded-2xl border bg-muted p-3 font-semibold">
                  <input
                    type="checkbox"
                    checked={castling.includes(right)}
                    onChange={(event) => updateCastling(right, event.target.checked)}
                  />
                  {right}
                </label>
              ))}
            </div>
            <Field label="Generated / loaded FEN" value={fenText} onChange={(event) => setFenText(event.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={loadFen}>Load FEN</Button>
              <Button variant="secondary" onClick={() => {
                const fen = refreshFen();
                void navigator.clipboard.writeText(fen).catch(() => {});
                setMessage("FEN generated and copied.");
              }}>
                Generate FEN
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black">Actions</h2>
          <p className="mt-3 rounded-2xl bg-muted p-4 text-sm">{message}</p>
          <p className="mt-2 font-mono text-sm">{stockfishText(engineResult)}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={clearBoard}>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear
            </Button>
            <Button variant="secondary" onClick={startPosition}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Start
            </Button>
            <Button onClick={analyzePosition} disabled={thinking}>
              <Activity className="mr-2 h-4 w-4" />
              Analyze
            </Button>
            <Button variant="secondary" onClick={() => router.push(`/analysis-board?fen=${encodeURIComponent(currentFen())}`)}>
              <Search className="mr-2 h-4 w-4" />
              Analysis
            </Button>
            <Button className="col-span-2" variant="secondary" onClick={() => router.push(`/play?fen=${encodeURIComponent(currentFen())}`)}>
              Start game from position
            </Button>
          </div>
        </Card>
      </aside>
    </div>
  );
}

export default function BoardEditorPage() {
  return (
    <Suspense fallback={<Card>Loading board editor...</Card>}>
      <BoardEditorInner />
    </Suspense>
  );
}
