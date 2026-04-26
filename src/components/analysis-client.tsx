"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { ChevronLeft, ChevronRight, Cpu } from "lucide-react";
import type { GameAnalysis, SavedGame } from "@/lib/types";
import { analyzeMoves } from "@/lib/chess-utils";
import { runStockfishGameAnalysis } from "@/lib/stockfish-client";
import { getSavedGame, getSavedGames } from "@/lib/storage";
import { fetchGameFromSupabase } from "@/lib/supabase-data";
import { Badge, Button, Card, LinkButton } from "@/components/ui";

function positionAt(moves: string[], ply: number) {
  const chess = new Chess();
  for (const move of moves.slice(0, ply)) {
    try {
      chess.move(move);
    } catch {
      break;
    }
  }
  return chess.fen();
}

function fallbackGame(): SavedGame {
  const moves = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "Ng5", "d5", "exd5", "Nxd5"];
  const analysis = analyzeMoves(moves);
  const chess = new Chess();
  moves.forEach((move) => chess.move(move));
  return {
    id: "sample",
    mode: "bot",
    result: "*",
    winner: null,
    opponent: "Sample bot",
    moves,
    pgn: chess.pgn(),
    finalPosition: chess.fen(),
    whiteAccuracy: analysis.whiteAccuracy,
    blackAccuracy: analysis.blackAccuracy,
    analysis,
    createdAt: new Date().toISOString(),
  };
}

export function AnalysisClient() {
  const params = useSearchParams();
  const initialGame = useMemo(() => {
    const id = params.get("id");
    if (id) return getSavedGame(id) ?? fallbackGame();
    return getSavedGames()[0] ?? fallbackGame();
  }, [params]);
  const [game, setGame] = useState(initialGame);
  const [ply, setPly] = useState(initialGame.moves.length);
  const [analysis, setAnalysis] = useState<GameAnalysis>(initialGame.analysis ?? analyzeMoves(initialGame.moves));
  const [engineProgress, setEngineProgress] = useState<{ done: number; total: number } | null>(null);
  const [engineError, setEngineError] = useState("");

  useEffect(() => {
    const id = params.get("id");
    if (!id) return;
    void fetchGameFromSupabase(id).then((remoteGame) => {
      if (!remoteGame) return;
      setGame(remoteGame);
      setPly(remoteGame.moves.length);
      setAnalysis(remoteGame.analysis ?? analyzeMoves(remoteGame.moves));
    });
  }, [params]);

  async function runDeepAnalysis() {
    setEngineError("");
    setEngineProgress({ done: 0, total: game.moves.length });
    try {
      const stockfishAnalysis = await runStockfishGameAnalysis(game.moves, (done, total) => {
        setEngineProgress({ done, total });
      });
      setAnalysis(stockfishAnalysis);
    } catch {
      setEngineError("Stockfish could not finish analysis in this browser. Showing MVP analysis.");
    } finally {
      setEngineProgress(null);
    }
  }

  const evalPoints = analysis.evaluations.map((item, index) => ({
    x: analysis.evaluations.length <= 1 ? 0 : (index / (analysis.evaluations.length - 1)) * 100,
    y: 50 - Math.max(-900, Math.min(900, item.scoreAfter)) / 18,
  }));
  const evalPath = evalPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <Card className="p-3 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
          <div>
            <Badge>{game.mode} analysis</Badge>
            <h1 className="mt-2 text-3xl font-black">Game analysis</h1>
          </div>
          <Badge>{game.result}</Badge>
        </div>
        <div className="mx-auto max-w-[min(82vh,720px)]">
          <Chessboard
            options={{
              position: positionAt(game.moves, ply),
              allowDragging: false,
              boardStyle: {
                borderRadius: "1.5rem",
                boxShadow: "0 24px 80px rgba(0,0,0,0.22)",
                overflow: "hidden",
              },
              lightSquareStyle: { backgroundColor: "#e8d4aa" },
              darkSquareStyle: { backgroundColor: "#58764a" },
            }}
          />
        </div>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={() => setPly((value) => Math.max(0, value - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-mono text-sm">{ply} / {game.moves.length}</span>
          <Button variant="secondary" onClick={() => setPly((value) => Math.min(game.moves.length, value + 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <aside className="grid gap-4 content-start">
        <Card>
          <h2 className="text-xl font-black">AI Coach summary</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{analysis.summary}</p>
          <p className="mt-4 rounded-2xl bg-muted p-4 text-sm font-medium">{analysis.trainingFocus}</p>
          <Button
            className="mt-4 w-full"
            variant="secondary"
            onClick={runDeepAnalysis}
            disabled={Boolean(engineProgress)}
          >
            <Cpu className="mr-2 h-4 w-4" />
            {engineProgress
              ? `Stockfish ${engineProgress.done}/${engineProgress.total}`
              : "Run Stockfish deep analysis"}
          </Button>
          {engineError ? (
            <p className="mt-3 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
              {engineError}
            </p>
          ) : null}
        </Card>
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <p className="text-sm text-muted-foreground">White accuracy</p>
            <p className="font-mono text-4xl font-black">{analysis.whiteAccuracy}%</p>
          </Card>
          <Card>
            <p className="text-sm text-muted-foreground">Black accuracy</p>
            <p className="font-mono text-4xl font-black">{analysis.blackAccuracy}%</p>
          </Card>
        </div>
        <Card className="max-h-[28rem] overflow-auto">
          <h2 className="text-xl font-black">Move review</h2>
          <div className="mt-4 grid gap-2">
            {analysis.evaluations.map((item, index) => (
              <button
                key={`${item.moveNumber}-${item.san}-${index}`}
                className="rounded-2xl bg-muted p-3 text-left text-sm transition hover:bg-border"
                onClick={() => setPly(index + 1)}
              >
                <span className="font-mono font-bold">{item.moveNumber}. {item.san}</span>
                <Badge className="ml-2">{item.type}</Badge>
                {item.bestMove ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    best: {item.bestMove}
                  </span>
                ) : null}
                <span className="mt-1 block text-muted-foreground">{item.note}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-black">Engine graph</h2>
          <svg className="mt-4 h-32 w-full overflow-visible rounded-2xl bg-muted" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="0" x2="100" y1="50" y2="50" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1" />
            <path d={evalPath} fill="none" stroke="var(--primary)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          </svg>
          <p className="mt-3 text-xs text-muted-foreground">
            Positive values favor White, negative values favor Black. Run Stockfish for deeper engine points.
          </p>
        </Card>
        <LinkButton href="/history" variant="secondary">Back to history</LinkButton>
      </aside>
    </div>
  );
}
