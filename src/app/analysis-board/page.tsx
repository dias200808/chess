"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Chess, type Square } from "chess.js";
import { Activity, Copy, Download, Search, Upload } from "lucide-react";
import { Chessboard } from "@/components/client-chessboard";
import { Badge, Button, Card, Field } from "@/components/ui";
import { animationDuration, boardColors } from "@/lib/board-visuals";
import { START_FEN } from "@/lib/game-config";
import { getSettings } from "@/lib/storage";
import { getStockfishBestMove, type StockfishResult } from "@/lib/stockfish-client";
import { normalizeFenInput } from "@/lib/position-utils";

function scoreLabel(result: StockfishResult | null) {
  if (!result) return "No engine result yet.";
  if (typeof result.mate === "number") return `${result.bestMoveSan ?? result.bestMove} · mate ${result.mate}`;
  if (typeof result.scoreCp === "number") {
    const pawns = result.scoreCp / 100;
    return `${result.bestMoveSan ?? result.bestMove} · ${pawns > 0 ? "+" : ""}${pawns.toFixed(2)}`;
  }
  return result.bestMoveSan ?? result.bestMove;
}

function AnalysisBoardInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialFen = params.get("fen");
  const [position, setPosition] = useState(() => {
    try {
      return initialFen ? new Chess(normalizeFenInput(initialFen)).fen() : START_FEN;
    } catch {
      return START_FEN;
    }
  });
  const [fenText, setFenText] = useState(position);
  const [pgnText, setPgnText] = useState("");
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [highlightedSquares, setHighlightedSquares] = useState<string[]>([]);
  const [engineEnabled, setEngineEnabled] = useState(false);
  const [engineResult, setEngineResult] = useState<StockfishResult | null>(null);
  const [message, setMessage] = useState("Free analysis board. Move pieces, import PGN/FEN, draw arrows, or ask Stockfish.");
  const [thinking, setThinking] = useState(false);
  const settings = getSettings();
  const colors = boardColors(settings);
  const chess = useMemo(() => new Chess(position), [position]);
  const selectedTargets =
    selectedSquare && settings.legalMoves
      ? chess.moves({ square: selectedSquare as Square, verbose: true }).map((move) => move.to)
      : [];
  const lastMove = chess.history({ verbose: true }).at(-1);

  function syncFromChess(next: Chess) {
    setPosition(next.fen());
    setFenText(next.fen());
    setPgnText(next.pgn());
  }

  function applyFen() {
    try {
      const next = new Chess(normalizeFenInput(fenText));
      syncFromChess(next);
      setMessage("FEN imported.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid FEN.");
    }
  }

  function applyPgn() {
    try {
      const next = new Chess();
      next.loadPgn(pgnText);
      syncFromChess(next);
      setMessage("PGN imported.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid PGN.");
    }
  }

  function exportFen() {
    const fen = chess.fen();
    setFenText(fen);
    void navigator.clipboard.writeText(fen).catch(() => {});
    setMessage("FEN exported and copied.");
  }

  function exportPgn() {
    const pgn = chess.pgn() || "*";
    setPgnText(pgn);
    void navigator.clipboard.writeText(pgn).catch(() => {});
    setMessage("PGN exported and copied.");
  }

  async function analyzePosition() {
    setThinking(true);
    setEngineEnabled(true);
    setMessage("Stockfish is analyzing this position...");
    try {
      const result = await getStockfishBestMove(chess.fen(), {
        depth: 13,
        moveTime: 900,
        timeout: 12000,
      });
      setEngineResult(result);
      setMessage(result ? `Best move: ${scoreLabel(result)}` : "Stockfish did not return a move.");
    } finally {
      setThinking(false);
    }
  }

  function tryMove(sourceSquare: string, targetSquare: string | null) {
    if (!targetSquare) return false;
    const next = new Chess(position);
    try {
      const move = next.move({ from: sourceSquare, to: targetSquare, promotion: settings.autoQueen ? "q" : "q" });
      syncFromChess(next);
      setHighlightedSquares([move.from, move.to]);
      setSelectedSquare(null);
      setMessage(`Moved ${move.san}.`);
      return true;
    } catch {
      setMessage("Illegal move for this analysis position.");
      return false;
    }
  }

  function onSquareClick({ square }: { square: string }) {
    const piece = chess.get(square as Square);
    if (selectedSquare && selectedTargets.includes(square as Square)) {
      tryMove(selectedSquare, square);
      return;
    }
    if (piece && piece.color === chess.turn()) {
      setSelectedSquare(square);
      return;
    }
    setSelectedSquare(null);
  }

  function toggleHighlight(square: string) {
    setHighlightedSquares((current) =>
      current.includes(square) ? current.filter((item) => item !== square) : [...current, square],
    );
  }

  const bestMoveSquares =
    engineResult?.bestMove && engineResult.bestMove.length >= 4
      ? [engineResult.bestMove.slice(0, 2), engineResult.bestMove.slice(2, 4)]
      : [];
  const squareStyles = {
    ...(settings.lastMoveHighlight && lastMove
      ? {
          [lastMove.from]: { background: "rgba(240, 184, 77, 0.48)" },
          [lastMove.to]: { background: "rgba(240, 184, 77, 0.48)" },
        }
      : {}),
    ...Object.fromEntries(highlightedSquares.map((square) => [square, { background: "rgba(240, 184, 77, 0.62)" }])),
    ...(selectedSquare ? { [selectedSquare]: { background: "rgba(96, 197, 141, 0.58)" } } : {}),
    ...Object.fromEntries(
      selectedTargets.map((target) => [
        target,
        { background: "radial-gradient(circle, rgba(31, 122, 77, 0.48) 24%, transparent 27%)" },
      ]),
    ),
    ...Object.fromEntries(
      bestMoveSquares.map((square) => [
        square,
        { background: "radial-gradient(circle, rgba(96, 197, 141, 0.65) 34%, transparent 38%)" },
      ]),
    ),
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <Card className="p-3 sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <Badge>Analysis board</Badge>
            <h1 className="mt-2 text-3xl font-black">Free Analysis Board</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{chess.turn() === "w" ? "White to move" : "Black to move"}</Badge>
            {engineEnabled ? <Badge>Stockfish on</Badge> : null}
          </div>
        </div>
        <div className="mx-auto max-w-[min(82vh,760px)]">
          <Chessboard
            options={{
              position,
              onPieceDrop: ({ sourceSquare, targetSquare }) => tryMove(sourceSquare, targetSquare),
              onSquareClick,
              onSquareRightClick: ({ square }) => toggleHighlight(square),
              allowDrawingArrows: true,
              clearArrowsOnClick: false,
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
          <h2 className="text-xl font-black">Engine</h2>
          <p className="mt-3 rounded-2xl bg-muted p-4 text-sm">{message}</p>
          <p className="mt-3 font-mono text-sm">{scoreLabel(engineResult)}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button onClick={analyzePosition} disabled={thinking}>
              <Activity className="mr-2 h-4 w-4" />
              {thinking ? "Thinking..." : "Analyze"}
            </Button>
            <Button variant="secondary" onClick={() => setEngineEnabled((value) => !value)}>
              <Search className="mr-2 h-4 w-4" />
              Stockfish
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black">FEN</h2>
          <Field label="Import / export FEN" value={fenText} onChange={(event) => setFenText(event.target.value)} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={applyFen}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button variant="secondary" onClick={exportFen}>
              <Copy className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black">PGN</h2>
          <textarea
            className="mt-3 min-h-32 w-full rounded-2xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            value={pgnText}
            onChange={(event) => setPgnText(event.target.value)}
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={applyPgn}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button variant="secondary" onClick={exportPgn}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black">Position</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => router.push(`/play?fen=${encodeURIComponent(chess.fen())}`)}>
              Start game
            </Button>
            <Button variant="secondary" onClick={() => router.push(`/board-editor?fen=${encodeURIComponent(chess.fen())}`)}>
              Edit board
            </Button>
          </div>
        </Card>
      </aside>
    </div>
  );
}

export default function AnalysisBoardPage() {
  return (
    <Suspense fallback={<Card>Loading analysis board...</Card>}>
      <AnalysisBoardInner />
    </Suspense>
  );
}
