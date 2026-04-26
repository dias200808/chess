"use client";

import { useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { RotateCcw, Save, Search, ShieldOff, Shuffle } from "lucide-react";
import { getBotProfile } from "@/lib/bot-profiles";
import type { BotDifficulty, GameMode, SavedGame } from "@/lib/types";
import { analyzeMoves, chooseBotMove, getGameResult, squareTargets } from "@/lib/chess-utils";
import { getStockfishBestMove } from "@/lib/stockfish-client";
import { getSettings, saveGame } from "@/lib/storage";
import { saveGameToSupabase } from "@/lib/supabase-data";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card, LinkButton } from "@/components/ui";

function replay(moves: string[]) {
  const chess = new Chess();
  for (const move of moves) {
    try {
      chess.move(move);
    } catch {
      break;
    }
  }
  return chess;
}

function findMoveFromUci(chess: Chess, uci: string) {
  return chess
    .moves({ verbose: true })
    .find(
      (move) =>
        `${move.from}${move.to}${move.promotion ?? ""}` === uci ||
        `${move.from}${move.to}` === uci,
    );
}

function playTone(type: "move" | "capture" | "end") {
  if (typeof window === "undefined") return;
  if (!getSettings().sounds) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = type === "capture" ? 180 : type === "end" ? 520 : 320;
  gain.gain.value = 0.04;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.08);
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export function ChessGame({
  mode = "local",
  playerColor = "white",
  difficulty = "elo-800",
}: {
  mode?: GameMode;
  playerColor?: "white" | "black";
  difficulty?: BotDifficulty;
}) {
  const { user, updateProfile } = useAuth();
  const [moves, setMoves] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<"white" | "black">(playerColor);
  const [hoverSquare, setHoverSquare] = useState<string | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [resignedBy, setResignedBy] = useState<"white" | "black" | null>(null);

  const chess = useMemo(() => replay(moves), [moves]);
  const result = resignedBy
    ? {
        result: resignedBy === "white" ? "0-1" : "1-0",
        winner: resignedBy === "white" ? ("black" as const) : ("white" as const),
        label: `${resignedBy === "white" ? "White" : "Black"} resigned.`,
      } as const
    : getGameResult(chess);
  const isGameOver = result.result !== "*";
  const lastMove = chess.history({ verbose: true }).at(-1);
  const botColor = playerColor === "white" ? "b" : "w";
  const isBotTurn = mode === "bot" && chess.turn() === botColor && !isGameOver;
  const botProfile = useMemo(() => getBotProfile(difficulty), [difficulty]);

  useEffect(() => {
    if (!isBotTurn) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      async function playBotMove() {
        let botMove = null;

        if (botProfile.useStockfish) {
          const result = await getStockfishBestMove(chess.fen(), {
            depth: botProfile.stockfishDepth,
            moveTime: botProfile.stockfishMoveTime,
            elo: botProfile.id === "stockfish" ? undefined : botProfile.elo,
          });
          botMove = result?.bestMove ? findMoveFromUci(chess, result.bestMove) ?? null : null;
        }

        botMove ??= chooseBotMove(chess.fen(), difficulty);
        if (!botMove || cancelled) return;
        setMoves((current) => [...current, botMove.san]);
        playTone(botMove.isCapture() ? "capture" : "move");
      }

      void playBotMove();
    }, 550);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [botProfile, chess, difficulty, isBotTurn]);

  useEffect(() => {
    if (isGameOver) playTone("end");
  }, [isGameOver]);

  const targets = selectedSquare
    ? squareTargets(chess.fen(), selectedSquare)
    : hoverSquare
      ? squareTargets(chess.fen(), hoverSquare)
      : [];
  const squareStyles = Object.fromEntries([
    ...(lastMove
      ? [
          [lastMove.from, { background: "rgba(240, 184, 77, 0.55)" }],
          [lastMove.to, { background: "rgba(240, 184, 77, 0.55)" }],
        ]
      : []),
    ...(selectedSquare
      ? [[selectedSquare, { background: "rgba(96, 197, 141, 0.55)" }]]
      : []),
    ...targets.map((target) => [
      target,
      {
        background:
          "radial-gradient(circle, rgba(31, 122, 77, 0.46) 24%, transparent 27%)",
      },
    ]),
  ]);

  function canDragPiece({ piece }: { piece: { pieceType: string } }) {
    if (isGameOver || isBotTurn) return false;
    if (mode !== "bot") return true;
    return playerColor === "white"
      ? piece.pieceType.startsWith("w")
      : piece.pieceType.startsWith("b");
  }

  function onDrop({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }) {
    if (!targetSquare || isGameOver || isBotTurn) return false;
    const next = replay(moves);

    try {
      const move = next.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });
      setMoves((current) => [...current, move.san]);
      setSelectedSquare(null);
      playTone(move.isCapture() ? "capture" : "move");
      return true;
    } catch {
      return false;
    }
  }

  function onSquareClick({ square }: { square: string }) {
    if (isGameOver || isBotTurn) return;
    const piece = chess.get(square as Square);

    if (selectedSquare && targets.includes(square as Square)) {
      onDrop({ sourceSquare: selectedSquare, targetSquare: square });
      return;
    }

    if (!piece) {
      setSelectedSquare(null);
      return;
    }

    const isPlayerPiece =
      mode !== "bot" ||
      (playerColor === "white" ? piece.color === "w" : piece.color === "b");

    if (piece.color === chess.turn() && isPlayerPiece) {
      setSelectedSquare(square);
    }
  }

  function newGame() {
    setMoves([]);
    setSavedId(null);
    setResignedBy(null);
  }

  function resign() {
    if (isGameOver) return;
    const side = chess.turn() === "w" ? "white" : "black";
    setResignedBy(side);
  }

  async function persistGame() {
    const analysis = analyzeMoves(moves);
    const id = savedId ?? crypto.randomUUID();
    const game: SavedGame = {
      id,
      mode,
      whiteUserId: playerColor === "white" ? user?.id : undefined,
      blackUserId: playerColor === "black" ? user?.id : undefined,
      result: result.result,
      winner: result.winner,
      opponent:
        mode === "bot"
          ? `${botProfile.name} ${botProfile.elo}`
          : mode === "friend"
            ? "Friend link"
            : "Local player",
      moves,
      pgn: chess.pgn(),
      finalPosition: chess.fen(),
      whiteAccuracy: analysis.whiteAccuracy,
      blackAccuracy: analysis.blackAccuracy,
      analysis,
      createdAt: new Date().toISOString(),
    };

    saveGame(game);
    try {
      await saveGameToSupabase(game);
    } catch {
      // Keep the local save if Supabase is unavailable or policies reject anonymous games.
    }
    setSavedId(id);

    if (user && result.result !== "*") {
      const userSide = playerColor;
      const userWon = result.winner === userSide;
      const draw = result.winner === "draw";
      await updateProfile({
        gamesCount: user.gamesCount + 1,
        wins: user.wins + (userWon ? 1 : 0),
        losses: user.losses + (!userWon && !draw ? 1 : 0),
        draws: user.draws + (draw ? 1 : 0),
        rating: user.rating + (draw ? 0 : userWon ? 10 : -10),
      });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <Card className="overflow-hidden p-3 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
          <div>
            <Badge>{mode === "bot" ? `${botProfile.name} (${botProfile.elo})` : mode}</Badge>
            <h1 className="mt-2 text-2xl font-black tracking-tight">{result.label}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={newGame}>
              <RotateCcw className="mr-2 h-4 w-4" />
              New
            </Button>
            <Button variant="secondary" onClick={() => setOrientation((side) => (side === "white" ? "black" : "white"))}>
              <Shuffle className="mr-2 h-4 w-4" />
              Flip
            </Button>
          </div>
        </div>

        <div className="mx-auto max-w-[min(82vh,720px)]">
          <Chessboard
            options={{
              id: `knightly-${mode}`,
              position: chess.fen(),
              boardOrientation: orientation,
              onPieceDrop: onDrop,
              onSquareClick,
              canDragPiece,
              onMouseOverSquare: ({ square }) => setHoverSquare(square),
              onMouseOutSquare: () => setHoverSquare(null),
              squareStyles,
              showAnimations: true,
              animationDurationInMs: 180,
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
      </Card>

      <aside className="grid gap-4">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="text-lg font-bold">
                {isBotTurn
                  ? botProfile.useStockfish
                    ? "Stockfish calculating..."
                    : "Bot thinking..."
                  : result.label}
              </p>
            </div>
            <Badge>{chess.turn() === "w" ? "White" : "Black"} turn</Badge>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="danger" onClick={resign} disabled={isGameOver}>
              <ShieldOff className="mr-2 h-4 w-4" />
              Resign
            </Button>
            <Button variant="primary" onClick={persistGame}>
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>
          <LinkButton
            href={savedId ? `/analysis?id=${savedId}` : "/analysis"}
            variant="secondary"
            className="mt-3 w-full"
          >
            <Search className="mr-2 h-4 w-4" />
            Analyze
          </LinkButton>
          {savedId ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Saved {formatDate(new Date())}. Open it from history any time.
            </p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Games are saved locally now and match the Supabase games schema for deployment.
            </p>
          )}
        </Card>

        <Card className="max-h-[34rem] overflow-auto">
          <h2 className="text-lg font-black">Move history</h2>
          {moves.length ? (
            <div className="mt-4 grid grid-cols-[3rem_1fr_1fr] gap-2 text-sm">
              {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, index) => (
                <div key={index} className="contents">
                  <span className="font-mono text-muted-foreground">{index + 1}.</span>
                  <span className="rounded-xl bg-muted px-3 py-2 font-mono">
                    {moves[index * 2]}
                  </span>
                  <span className="rounded-xl bg-muted px-3 py-2 font-mono">
                    {moves[index * 2 + 1] ?? ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Drag a piece to begin. Illegal moves, castling, en passant, promotion, checkmate, and stalemate are enforced by chess.js.
            </p>
          )}
        </Card>
      </aside>
    </div>
  );
}
