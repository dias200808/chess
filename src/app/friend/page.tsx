"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Chess, type Square } from "chess.js";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Copy,
  Download,
  Link as LinkIcon,
  Loader2,
  RotateCcw,
  Search,
  Shield,
  UserPlus,
  X,
} from "lucide-react";
import { Chessboard } from "@/components/client-chessboard";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card, LinkButton } from "@/components/ui";
import { animationDuration, boardColors } from "@/lib/board-visuals";
import { getGameResult, squareTargets } from "@/lib/chess-utils";
import { getTimeControlPreset } from "@/lib/game-config";
import {
  DISCONNECT_FORFEIT_MS,
} from "@/lib/online-room-rules";
import { getOnlinePlayerKey, roomSideKey } from "@/lib/online-player";
import { ratingForProfile, ratingTypeForTimeControl } from "@/lib/rating";
import { getSettings, logStudentActivity, rememberGuestGame, saveGame } from "@/lib/storage";
import {
  fetchGameFromSupabase,
  fetchRoomFromSupabase,
  isSupabaseConfigured,
  subscribeToRoom,
} from "@/lib/supabase-data";
import type { Room, SavedGame } from "@/lib/types";

type OnlineSide = "white" | "black" | "spectator";
type PromotionPiece = "q" | "r" | "b" | "n";
type PendingPromotion = {
  from: string;
  to: string;
};
type ConfirmedMove = PendingPromotion & {
  promotion: PromotionPiece;
};

const PRESENCE_PING_MS = 4_000;
const PRESENCE_STALE_MS = 12_000;

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

function formatClock(ms?: number | null) {
  if (ms === null || ms === undefined) return "--:--";
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  return `${totalSeconds}s`;
}

function ageMs(timestamp: string | null | undefined, nowMs: number) {
  if (!timestamp) return null;
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, nowMs - parsed);
}

function remainingMs(timestamp: string | null | undefined, nowMs: number) {
  if (!timestamp) return null;
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, parsed - nowMs);
}

function isStale(timestamp: string | null | undefined, nowMs: number) {
  const age = ageMs(timestamp, nowMs);
  return age !== null && age > PRESENCE_STALE_MS;
}

function findKingSquare(chess: Chess, color: "w" | "b") {
  const board = chess.board();
  for (let rank = 0; rank < board.length; rank += 1) {
    for (let file = 0; file < board[rank].length; file += 1) {
      const piece = board[rank][file];
      if (!piece || piece.type !== "k" || piece.color !== color) continue;
      return `${String.fromCharCode(97 + file)}${8 - rank}`;
    }
  }
  return null;
}

function playerMeta(room: Room | null, side: "white" | "black") {
  if (!room) return { name: side === "white" ? "White" : "Black", label: "guest", rating: null as number | null };
  const name = side === "white" ? room.whitePlayer : room.blackPlayer;
  const type = side === "white" ? room.whitePlayerType : room.blackPlayerType;
  const rating = side === "white" ? room.whiteRating : room.blackRating;
  return {
    name: name ?? (side === "white" ? "White" : "Black"),
    label: type === "account" ? "account" : "guest",
    rating: typeof rating === "number" ? rating : null,
  };
}

function sideLabel(side: OnlineSide | null) {
  if (side === "white") return "White";
  if (side === "black") return "Black";
  if (side === "spectator") return "Spectator";
  return "Unknown";
}

function isAbortReason(endReason?: string | null) {
  return Boolean(endReason?.toLowerCase().startsWith("game aborted"));
}

function createSavedGame(room: Room, viewerId?: string | null) {
  const chess = replay(room.moves ?? []);
  const moves = room.moves ?? [];
  const white = playerMeta(room, "white");
  const black = playerMeta(room, "black");
  const viewerIsWhite = viewerId && room.whiteUserId === viewerId;
  const viewerIsBlack = viewerId && room.blackUserId === viewerId;
  const aborted = isAbortReason(room.endReason);

  return {
    id: room.id,
    whiteUserId: room.whiteUserId,
    blackUserId: room.blackUserId,
    whiteGuestKey: room.hostKey,
    blackGuestKey: room.guestKey,
    whitePlayer: white.name,
    blackPlayer: black.name,
    mode: room.matchType === "quick" ? "online" : "friend",
    matchType: room.matchType,
    result: (room.result ?? "*") as SavedGame["result"],
    winner:
      room.result === "1-0" ? "white" : room.result === "0-1" ? "black" : room.result === "1/2-1/2" ? "draw" : null,
    endReason: room.endReason ?? "Online game",
    opponent: viewerIsWhite ? black.name : viewerIsBlack ? white.name : "Online opponent",
    moves,
    pgn: chess.pgn(),
    finalPosition: chess.fen(),
    timeControl: room.timeControl,
    gameType: room.gameType,
    rated: room.gameType === "rated" && !aborted,
    ratingType: room.timeControl ? ratingTypeForTimeControl(getTimeControlPreset(room.timeControl)) ?? undefined : undefined,
    whiteAccuracy: 0,
    blackAccuracy: 0,
    analysis: {
      summary: "Run analysis to review this online game.",
      whiteAccuracy: 0,
      blackAccuracy: 0,
      evaluations: [],
      trainingFocus: "Open the analysis page to generate feedback.",
    },
    createdAt: room.createdAt,
  } satisfies SavedGame;
}

function downloadPgn(game: SavedGame) {
  const blob = new Blob([game.pgn || "*"], { type: "application/x-chess-pgn;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `game-${game.id}.pgn`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function playTone(type: "move" | "capture" | "check" | "mate" | "start" | "end" | "low" | "draw" | "disconnect" | "error") {
  if (typeof window === "undefined") return;
  const settings = getSettings();
  if (!settings.sounds) return;
  const AudioCtor =
    window.AudioContext ||
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return;

  const context = new AudioCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const frequency =
    type === "capture"
      ? 180
      : type === "check"
        ? 420
        : type === "mate"
          ? 620
          : type === "start"
            ? 520
            : type === "end"
              ? 300
              : type === "low"
                ? 860
                : type === "draw"
                  ? 470
                  : type === "disconnect"
                    ? 210
                    : type === "error"
                      ? 140
                      : 320;

  oscillator.frequency.value = frequency;
  gain.gain.value = type === "low" ? 0.06 : 0.04;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + (type === "mate" || type === "start" ? 0.14 : 0.08));
  void context.close().catch(() => {});
}

function vibrateIfAvailable(duration: number) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  navigator.vibrate(duration);
}

function FriendClient() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const roomId = params.get("room");
  const canUseRealtime = isSupabaseConfigured();
  const playerKey = getOnlinePlayerKey(user?.id);
  const settings = useMemo(() => getSettings(), []);
  const colors = useMemo(() => boardColors(settings), [settings]);

  const [room, setRoom] = useState<Room | null>(null);
  const [moves, setMoves] = useState<string[]>([]);
  const [playerSide, setPlayerSide] = useState<OnlineSide | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [hoverSquare, setHoverSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [pendingConfirmMove, setPendingConfirmMove] = useState<ConfirmedMove | null>(null);
  const [premove, setPremove] = useState<ConfirmedMove | null>(null);
  const [message, setMessage] = useState("");
  const [isLoadingRoom, setIsLoadingRoom] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [isMoveSubmitting, setIsMoveSubmitting] = useState(false);
  const [isConnectionUnstable, setIsConnectionUnstable] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [boardShake, setBoardShake] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const [savedGame, setSavedGame] = useState<SavedGame | null>(null);
  const [serverGame, setServerGame] = useState<SavedGame | null>(null);
  const autoSavedRef = useRef(false);
  const redirectedRematchRef = useRef<string | null>(null);
  const previousRoomRef = useRef<Room | null>(null);
  const lowTimePlayedRef = useRef({ white: false, black: false });

  const chess = useMemo(() => replay(moves), [moves]);
  const result = getGameResult(chess);
  const roomResult = room?.result && room.result !== "*" ? room.result : result.result;
  const isPlayableRoom = room?.status === "ready" && roomResult === "*";
  const currentTurnSide = chess.turn() === "w" ? "white" : "black";
  const lastMove = useMemo(() => chess.history({ verbose: true }).at(-1), [chess]);
  const selectedTargets = selectedSquare ? squareTargets(chess.fen(), selectedSquare) : [];
  const hoverTargets =
    !selectedSquare && hoverSquare && canSelectSquare(hoverSquare, false) ? squareTargets(chess.fen(), hoverSquare) : [];
  const visibleTargets = settings.legalMoves ? (selectedSquare ? selectedTargets : hoverTargets) : [];
  const inviteLink = room?.link || (typeof window !== "undefined" && roomId ? `${window.location.origin}/friend?room=${roomId}` : "");
  const activeRoomId = room?.id ?? null;
  const whiteMeta = playerMeta(room, "white");
  const blackMeta = playerMeta(room, "black");
  const timeControl = getTimeControlPreset(room?.timeControl ?? "10-0");
  const roomTitle = room?.matchType === "quick" ? "Online Match" : "Invite Match";
  const finishedGame = serverGame ?? savedGame;
  const viewerRatingDelta =
    user && serverGame
      ? serverGame.whiteUserId === user.id
        ? serverGame.whiteRatingChange
        : serverGame.blackUserId === user.id
          ? serverGame.blackRatingChange
          : undefined
      : undefined;
  const whiteCheckSquare = chess.isCheck() && chess.turn() === "w" ? findKingSquare(chess, "w") : null;
  const blackCheckSquare = chess.isCheck() && chess.turn() === "b" ? findKingSquare(chess, "b") : null;
  const opponentConnectedAge =
    playerSide === "white"
      ? ageMs(room?.blackConnectedAt, nowMs)
      : playerSide === "black"
        ? ageMs(room?.whiteConnectedAt, nowMs)
        : null;
  const opponentDisconnected = Boolean(
    room?.status === "ready" &&
      playerSide !== "spectator" &&
      isStale(playerSide === "white" ? room.blackConnectedAt : room?.whiteConnectedAt, nowMs),
  );
  const opponentDisconnectRemaining =
    opponentConnectedAge === null ? null : Math.max(0, DISCONNECT_FORFEIT_MS - opponentConnectedAge);
  const connectAbortRemaining = room?.status === "ready" && moves.length === 0 ? remainingMs(room.connectDeadlineAt, nowMs) : null;
  const firstMoveAbortRemaining = room?.status === "ready" && moves.length === 0 ? remainingMs(room.firstMoveDeadlineAt, nowMs) : null;
  const drawOfferCooldown =
    playerSide === "white"
      ? Math.max(0, (room?.whiteDrawBlockedUntilPly ?? 0) - moves.length)
      : playerSide === "black"
        ? Math.max(0, (room?.blackDrawBlockedUntilPly ?? 0) - moves.length)
        : 0;

  function liveClock(side: "white" | "black") {
    if (!room) return null;
    const base = side === "white" ? room.whiteTimeMs : room.blackTimeMs;
    if (base === null || base === undefined) return null;
    if (room.status !== "ready" || roomResult !== "*" || currentTurnSide !== side || !room.lastMoveAt) {
      return base;
    }
    return Math.max(0, base - Math.max(0, nowMs - new Date(room.lastMoveAt).getTime()));
  }

  const whiteClock = liveClock("white");
  const blackClock = liveClock("black");
  const canRespondToDraw = Boolean(isPlayableRoom && room?.drawOfferedBy && room.drawOfferedBy !== playerSide);
  const canOfferDraw = Boolean(
    isPlayableRoom &&
      playerSide !== "spectator" &&
      !room?.drawOfferedBy &&
      moves.length >= 2 &&
      drawOfferCooldown === 0,
  );

  function triggerBoardShake() {
    setBoardShake(false);
    window.setTimeout(() => setBoardShake(true), 10);
    window.setTimeout(() => setBoardShake(false), 280);
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!roomId || !canUseRealtime) return;
    const requestedRoomId = roomId;

    let disposed = false;
    let channel: ReturnType<typeof subscribeToRoom> | null = null;

    async function openRoom() {
      setIsLoadingRoom(true);
      setMessage("");

      try {
        const activeRoom = await fetchRoomFromSupabase(requestedRoomId);
        if (!activeRoom) {
          if (!disposed) {
            setRoom(null);
            setPlayerSide(null);
            setMessage("Room not found. Create a new online game link.");
            setIsLoadingRoom(false);
          }
          return;
        }

        let side = localStorage.getItem(roomSideKey(activeRoom.id)) as OnlineSide | null;
        if (!side) {
          if (activeRoom.hostKey === playerKey || (user?.id && activeRoom.whiteUserId === user.id)) {
            side = "white";
          } else if (activeRoom.guestKey === playerKey || (user?.id && activeRoom.blackUserId === user.id)) {
            side = "black";
          } else {
            side = "spectator";
          }
        }

        if (disposed) return;
        localStorage.setItem(roomSideKey(activeRoom.id), side);
        setPlayerSide(side);
        setRoom(activeRoom);
        setMoves(activeRoom.moves ?? []);
        setIsLoadingRoom(false);

        channel = subscribeToRoom(activeRoom.id, (nextRoom) => {
          setRoom(nextRoom);
          setMoves(nextRoom.moves ?? []);
        });
      } catch {
        if (!disposed) {
          setMessage("Could not load the room. Check Supabase room policies.");
          setIsLoadingRoom(false);
        }
      }
    }

    void openRoom();

    return () => {
      disposed = true;
      if (channel) channel.unsubscribe();
    };
  }, [canUseRealtime, playerKey, roomId, user?.id]);

  useEffect(() => {
    const rematchRoomId = room?.rematchRoomId;
    if (!rematchRoomId || redirectedRematchRef.current === rematchRoomId) return;
    redirectedRematchRef.current = rematchRoomId;

    void fetchRoomFromSupabase(rematchRoomId).then((nextRoom) => {
      if (!nextRoom) return;
      const nextSide =
        nextRoom.hostKey === playerKey || (user?.id && nextRoom.whiteUserId === user.id)
          ? "white"
          : nextRoom.guestKey === playerKey || (user?.id && nextRoom.blackUserId === user.id)
            ? "black"
            : "spectator";
      localStorage.setItem(roomSideKey(nextRoom.id), nextSide);
      router.push(`/friend?room=${nextRoom.id}`);
    });
  }, [playerKey, room?.rematchRoomId, router, user?.id]);

  useEffect(() => {
    if (!room?.id || room.status !== "finished" || autoSavedRef.current) return;
    autoSavedRef.current = true;

    const nextSavedGame = createSavedGame(room, user?.id);
    saveGame(nextSavedGame);
    setSavedGame(nextSavedGame);
    if (user) {
      logStudentActivity({
        userId: user.id,
        type: "played_game",
        title: "Played online game",
        relatedId: nextSavedGame.id,
        details: `${nextSavedGame.result} vs ${nextSavedGame.opponent}`,
        metadata: {
          moves: nextSavedGame.moves.length,
          timeControl: nextSavedGame.timeControl ?? "",
          accuracy:
            nextSavedGame.whiteUserId === user.id
              ? nextSavedGame.whiteAccuracy
              : nextSavedGame.blackAccuracy,
        },
      });
    }

    if (room.whitePlayerType === "guest" || room.blackPlayerType === "guest") {
      rememberGuestGame(room.id);
    }

    if (user) {
      void fetchGameFromSupabase(room.id)
        .then((remoteGame) => {
          if (remoteGame) setServerGame(remoteGame);
        })
        .catch(() => {});
    }
  }, [room, user]);

  useEffect(() => {
    if (!activeRoomId || !playerSide || playerSide === "spectator") return;
    let disposed = false;

    async function pingPresence() {
      try {
        const response = await fetch(`/api/rooms/${activeRoomId}/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerKey }),
        });
        const payload = (await response.json()) as { room?: Room };
        if (!disposed && payload.room) {
          setRoom(payload.room);
          setMoves(payload.room.moves ?? []);
        }
        if (!disposed) setIsConnectionUnstable(false);
      } catch {
        if (!disposed) setIsConnectionUnstable(true);
      }
    }

    void pingPresence();
    const timer = window.setInterval(() => void pingPresence(), PRESENCE_PING_MS);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [activeRoomId, playerKey, playerSide]);

  useEffect(() => {
    if (!room) return;
    const previousRoom = previousRoomRef.current;
    if (!previousRoom) {
      previousRoomRef.current = room;
      return;
    }

    if (previousRoom.status !== "ready" && room.status === "ready" && room.result === "*") {
      playTone("start");
    }

    if ((room.moves?.length ?? 0) > (previousRoom.moves?.length ?? 0)) {
      const previousChess = replay(previousRoom.moves ?? []);
      const nextChess = replay(room.moves ?? []);
      const nextMove = nextChess.history({ verbose: true }).at(-1);
      if (nextMove) {
        if (nextChess.isCheckmate()) {
          playTone("mate");
        } else if (nextChess.isCheck()) {
          playTone("check");
        } else {
          playTone(nextMove.isCapture() ? "capture" : "move");
        }
      } else if (nextChess.fen() !== previousChess.fen()) {
        playTone("move");
      }
    }

    if (room.drawOfferedBy && room.drawOfferedBy !== previousRoom.drawOfferedBy && room.drawOfferedBy !== playerSide) {
      playTone("draw");
    }

    if (room.status === "finished" && previousRoom.status !== "finished") {
      playTone("end");
    }

    previousRoomRef.current = room;
  }, [playerSide, room]);

  useEffect(() => {
    if (!opponentDisconnected) return;
    playTone("disconnect");
  }, [opponentDisconnected]);

  useEffect(() => {
    for (const side of ["white", "black"] as const) {
      const value = side === "white" ? whiteClock : blackClock;
      if (typeof value === "number" && value > 0 && value <= 10_000) {
        if (!lowTimePlayedRef.current[side]) {
          playTone("low");
          if (playerSide === side) vibrateIfAvailable(120);
          lowTimePlayedRef.current[side] = true;
        }
      } else if (typeof value === "number" && value > 12_000) {
        lowTimePlayedRef.current[side] = false;
      }
    }
  }, [blackClock, playerSide, whiteClock]);

  useEffect(() => {
    if (!room || !isPlayableRoom || !premove || playerSide === "spectator" || currentTurnSide !== playerSide || isMoveSubmitting) {
      return;
    }
    const legalTargets = squareTargets(chess.fen(), premove.from);
    if (!canSelectSquare(premove.from, true)) {
      window.setTimeout(() => setPremove(null), 0);
      return;
    }
    if (!legalTargets.includes(premove.to as Square)) {
      window.setTimeout(() => setPremove(null), 0);
      return;
    }
    void makeMove(premove.from, premove.to, premove.promotion, { fromPremove: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chess, currentTurnSide, isMoveSubmitting, isPlayableRoom, playerSide, premove, room]);

  useEffect(() => {
    if (!isPlayableRoom) {
      window.setTimeout(() => {
        setSelectedSquare(null);
        setPendingPromotion(null);
        setPendingConfirmMove(null);
      }, 0);
    }
  }, [isPlayableRoom]);

  function canSelectSquare(square: string, allowOffTurn: boolean) {
    if (!room || playerSide === "spectator") return false;
    const piece = chess.get(square as Square);
    if (!piece) return false;
    const ownsPiece = playerSide === "white" ? piece.color === "w" : piece.color === "b";
    if (!ownsPiece) return false;
    if (allowOffTurn) return true;
    return isPlayableRoom && playerSide === currentTurnSide;
  }

  function canMovePieceNow(square: string) {
    if (!isPlayableRoom || playerSide === "spectator" || playerSide !== currentTurnSide) return false;
    return canSelectSquare(square, false);
  }

  function canSetPremove(square: string) {
    if (!settings.premoves || !isPlayableRoom || playerSide === "spectator" || playerSide === currentTurnSide) return false;
    return canSelectSquare(square, true);
  }

  function needsPromotion(sourceSquare: string, targetSquare: string) {
    const piece = chess.get(sourceSquare as Square);
    if (!piece || piece.type !== "p") return false;
    return (piece.color === "w" && targetSquare.endsWith("8")) || (piece.color === "b" && targetSquare.endsWith("1"));
  }

  async function joinWaitingRoom() {
    if (!room) return;
    setActionLoading("join");
    try {
      const response = await fetch(`/api/rooms/${room.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerKey,
          playerType: user ? "account" : "guest",
          userId: user?.id ?? null,
          username: user?.username ?? undefined,
          rating:
            user && room.gameType === "rated" && room.timeControl
              ? ratingForProfile(user, ratingTypeForControl(room.timeControl))
              : null,
        }),
      });
      const payload = (await response.json()) as { room?: Room; side?: "white" | "black"; error?: string };
      if (!response.ok || !payload.room || !payload.side) {
        setMessage(payload.error ?? "Could not join this room.");
        return;
      }
      localStorage.setItem(roomSideKey(payload.room.id), payload.side);
      setPlayerSide(payload.side);
      setRoom(payload.room);
      setMoves(payload.room.moves ?? []);
      setMessage("");
    } catch {
      setMessage("Could not join the room.");
    } finally {
      setActionLoading("");
    }
  }

  async function sendRoomAction(
    action: "resign" | "offer_draw" | "accept_draw" | "decline_draw" | "cancel" | "request_rematch" | "accept_rematch",
  ) {
    if (!room || !playerSide || playerSide === "spectator") return;
    setActionLoading(action);
    try {
      const response = await fetch(`/api/rooms/${room.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerKey, action }),
      });
      const payload = (await response.json()) as { room?: Room; error?: string };
      if (!response.ok || !payload.room) {
        setMessage(payload.error ?? "Action rejected by server.");
        return;
      }

      const nextRoom = payload.room;
      const nextSide =
        nextRoom.hostKey === playerKey || (user?.id && nextRoom.whiteUserId === user.id)
          ? "white"
          : nextRoom.guestKey === playerKey || (user?.id && nextRoom.blackUserId === user.id)
            ? "black"
            : "spectator";

      localStorage.setItem(roomSideKey(nextRoom.id), nextSide);
      setPlayerSide(nextSide);
      setRoom(nextRoom);
      setMoves(nextRoom.moves ?? []);
      setMessage("");
      setShowResignConfirm(false);

      if (nextRoom.id !== room.id) {
        router.push(`/friend?room=${nextRoom.id}`);
      }
    } catch {
      setMessage("Could not send action to server.");
    } finally {
      setActionLoading("");
    }
  }

  async function makeMove(
    sourceSquare: string,
    targetSquare: string | null,
    promotion: PromotionPiece = "q",
    options?: { fromPremove?: boolean },
  ) {
    if (!targetSquare || !room || !canMovePieceNow(sourceSquare)) return false;
    if (!squareTargets(chess.fen(), sourceSquare).includes(targetSquare as Square)) {
      triggerBoardShake();
      playTone("error");
      return false;
    }

    setIsMoveSubmitting(true);
    try {
      const response = await fetch(`/api/rooms/${room.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerKey,
          from: sourceSquare,
          to: targetSquare,
          promotion,
        }),
      });
      const payload = (await response.json()) as { room?: Room; error?: string };

      if (payload.room) {
        setRoom(payload.room);
        setMoves(payload.room.moves ?? []);
      }

      if (!response.ok || !payload.room) {
        triggerBoardShake();
        playTone("error");
        setMessage(payload.error ?? "Move rejected by server.");
        return false;
      }

      setSelectedSquare(null);
      setHoverSquare(null);
      setPendingPromotion(null);
      setPendingConfirmMove(null);
      if (options?.fromPremove) {
        setPremove(null);
      }
      return true;
    } catch {
      triggerBoardShake();
      playTone("error");
      setMessage("Could not send move to server.");
      return false;
    } finally {
      setIsMoveSubmitting(false);
    }
  }

  function stageMove(sourceSquare: string, targetSquare: string, promotion?: PromotionPiece) {
    if (canMovePieceNow(sourceSquare)) {
      const finalPromotion = promotion ?? (settings.autoQueen && needsPromotion(sourceSquare, targetSquare) ? "q" : "q");
      if (needsPromotion(sourceSquare, targetSquare) && !settings.autoQueen && !promotion) {
        setPendingPromotion({ from: sourceSquare, to: targetSquare });
        return;
      }
      if (settings.moveConfirmation) {
        setPendingConfirmMove({ from: sourceSquare, to: targetSquare, promotion: finalPromotion });
        setSelectedSquare(null);
        return;
      }
      void makeMove(sourceSquare, targetSquare, finalPromotion);
      return;
    }

    if (canSetPremove(sourceSquare)) {
      setPremove({
        from: sourceSquare,
        to: targetSquare,
        promotion: promotion ?? "q",
      });
      setSelectedSquare(null);
      setPendingPromotion(null);
      setPendingConfirmMove(null);
      setMessage("Premove set.");
    }
  }

  function onSquareClick({ square }: { square: string }) {
    if (pendingPromotion) return;

    if (selectedSquare) {
      const ownsSelected = canMovePieceNow(selectedSquare) || canSetPremove(selectedSquare);
      const targets = squareTargets(chess.fen(), selectedSquare);
      if (ownsSelected && targets.includes(square as Square)) {
        stageMove(selectedSquare, square);
        return;
      }
    }

    if (canMovePieceNow(square) || canSetPremove(square)) {
      setSelectedSquare(square);
      return;
    }

    setSelectedSquare(null);
  }

  async function copyText(value: string, success: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(success);
    } catch {
      setMessage("Clipboard access was blocked.");
    }
  }

  function statusText() {
    if (isLoadingRoom) return "Loading room...";
    if (!room) return "Waiting for room...";
    if (room.status === "waiting") return "Waiting for opponent...";
    if (room.status === "finished") return room.endReason ?? result.label;
    if (isConnectionUnstable) return "Reconnecting...";
    if (opponentDisconnected) {
      return `Opponent disconnected. Waiting for reconnect... ${formatCountdown(opponentDisconnectRemaining ?? DISCONNECT_FORFEIT_MS)}`;
    }
    if (connectAbortRemaining !== null && !room.blackConnectedAt && moves.length === 0) {
      return `Waiting for opponent to connect... ${formatCountdown(connectAbortRemaining)}`;
    }
    if (firstMoveAbortRemaining !== null && moves.length === 0) {
      return `White has ${formatCountdown(firstMoveAbortRemaining)} to make the first move.`;
    }
    if (canRespondToDraw) return "Opponent offers a draw.";
    if (room.drawOfferedBy && room.drawOfferedBy === playerSide) return "Draw offered. Waiting for response.";
    if (playerSide !== "spectator" && currentTurnSide === playerSide && chess.isCheck()) return "You are in check.";
    if (playerSide !== "spectator" && currentTurnSide === playerSide) return "Your move.";
    if (playerSide !== "spectator" && currentTurnSide !== playerSide) return "Opponent is thinking.";
    if (chess.isCheck()) return `${currentTurnSide === "white" ? whiteMeta.name : blackMeta.name} is in check.`;
    return `${currentTurnSide === "white" ? whiteMeta.name : blackMeta.name} to move`;
  }

  function statusTone() {
    if (room?.status === "finished") {
      return isAbortReason(room.endReason) ? "warning" : room.result === "1/2-1/2" ? "info" : "success";
    }
    if (opponentDisconnected || isConnectionUnstable) return "warning";
    if (canRespondToDraw) return "info";
    if (playerSide !== "spectator" && currentTurnSide === playerSide && chess.isCheck()) return "warning";
    return "neutral";
  }

  function clockPanelClass(side: "white" | "black") {
    const low = side === "white" ? typeof whiteClock === "number" && whiteClock <= 10_000 : typeof blackClock === "number" && blackClock <= 10_000;
    return low && isPlayableRoom
      ? "border border-red-400/35 bg-red-500/12 text-red-50"
      : currentTurnSide === side && isPlayableRoom
        ? "border border-primary/30 bg-primary/12"
        : "bg-muted";
  }

  function ratingTypeForControl(timeControlId: string) {
    return ratingTypeForTimeControl(getTimeControlPreset(timeControlId)) ?? "overall";
  }

  function confirmPendingMove() {
    if (!pendingConfirmMove) return;
    void makeMove(pendingConfirmMove.from, pendingConfirmMove.to, pendingConfirmMove.promotion);
  }

  const boardArrows = premove
    ? [{ startSquare: premove.from, endSquare: premove.to, color: "rgba(96, 197, 141, 0.92)" }]
    : [];

  const squareStyles = Object.fromEntries([
    ...(settings.lastMoveHighlight && lastMove
      ? [
          [lastMove.from, { background: "rgba(240, 184, 77, 0.55)" }],
          [lastMove.to, { background: "rgba(240, 184, 77, 0.55)" }],
        ]
      : []),
    ...(selectedSquare ? [[selectedSquare, { background: "rgba(96, 197, 141, 0.5)" }]] : []),
    ...(premove
      ? [
          [premove.from, { background: "rgba(96, 197, 141, 0.24)" }],
          [premove.to, { background: "rgba(96, 197, 141, 0.28)" }],
        ]
      : []),
    ...(whiteCheckSquare ? [[whiteCheckSquare, { background: "rgba(248, 113, 113, 0.52)" }]] : []),
    ...(blackCheckSquare ? [[blackCheckSquare, { background: "rgba(248, 113, 113, 0.52)" }]] : []),
    ...visibleTargets.map((target) => [
      target,
      chess.get(target)
        ? {
            background:
              "radial-gradient(circle, transparent 42%, rgba(248, 113, 113, 0.95) 44%, rgba(248, 113, 113, 0.95) 56%, transparent 58%)",
            boxShadow: "inset 0 0 0 4px rgba(248, 113, 113, 0.7)",
          }
        : {
            background:
              "radial-gradient(circle, rgba(14, 165, 233, 0.92) 16%, rgba(255, 255, 255, 0.9) 18%, transparent 23%)",
          },
    ]),
  ]);

  if (!roomId) {
    return (
      <Card className="mx-auto max-w-2xl">
        <Badge>Online room</Badge>
        <h1 className="mt-3 text-3xl font-black">Open a room from the online lobby</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Create matchmaking or invite rooms from the dedicated online page, then you will return here for the live game.
        </p>
        <LinkButton href="/play/online" className="mt-5">
          Open /play/online
        </LinkButton>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <Card className="p-3 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge>{room?.matchType === "quick" ? "Quick matchmaking" : "Invite room"}</Badge>
            <h1 className="mt-2 text-2xl font-black">{roomTitle}</h1>
            <p className="text-sm text-muted-foreground">{room?.endReason ?? result.label}</p>
          </div>
          <Badge>
            {timeControl.label} · {room?.gameType ?? "casual"}
          </Badge>
        </div>

        <div
          className={`mb-4 flex items-start gap-3 rounded-2xl border p-3 text-sm ${
            statusTone() === "success"
              ? "border-primary/30 bg-primary/12"
              : statusTone() === "warning"
                ? "border-red-400/30 bg-red-500/10"
                : statusTone() === "info"
                  ? "border-sky-400/25 bg-sky-500/10"
                  : "border-border bg-muted/60"
          }`}
        >
          {statusTone() === "warning" ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          ) : statusTone() === "info" ? (
            <Bell className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-semibold">{statusText()}</p>
            {drawOfferCooldown > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">You can offer a draw again in {drawOfferCooldown} ply.</p>
            ) : null}
            {premove ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Premove queued: {premove.from} → {premove.to}
              </p>
            ) : null}
            {pendingConfirmMove ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Move confirmation ready: {pendingConfirmMove.from} → {pendingConfirmMove.to}
              </p>
            ) : null}
            {message ? <p className="mt-1 text-xs text-muted-foreground">{message}</p> : null}
          </div>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {([
            { side: "black" as const, meta: blackMeta },
            { side: "white" as const, meta: whiteMeta },
          ]).map(({ side, meta }) => (
            <div key={side} className={`rounded-2xl p-3 ${clockPanelClass(side)}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{side}</p>
                  <p className="font-black">{meta.name}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-semibold uppercase text-muted-foreground">{meta.label}</p>
                  <p className="font-mono text-sm font-black">{meta.rating ?? "--"}</p>
                </div>
              </div>
              <p className="mt-3 font-mono text-2xl font-black">{formatClock(side === "white" ? whiteClock : blackClock)}</p>
            </div>
          ))}
        </div>

        <div className={`relative mx-auto max-w-[min(100%,82vh,720px)] ${boardShake ? "board-shake" : ""}`}>
          <Chessboard
            options={{
              position: chess.fen(),
              boardOrientation: playerSide === "black" ? "black" : "white",
              onPieceDrop: ({ sourceSquare, targetSquare }) => {
                if (pendingPromotion) return false;
                if (!targetSquare) {
                  triggerBoardShake();
                  return false;
                }
                const isLive = canMovePieceNow(sourceSquare);
                const isPremove = canSetPremove(sourceSquare);
                if (!isLive && !isPremove) return false;
                if (!squareTargets(chess.fen(), sourceSquare).includes(targetSquare as Square)) {
                  triggerBoardShake();
                  playTone("error");
                  return false;
                }
                stageMove(sourceSquare, targetSquare);
                return true;
              },
              canDragPiece: ({ piece }) => {
                if (pendingPromotion || pendingConfirmMove || isMoveSubmitting) return false;
                if (playerSide === "spectator") return false;
                const currentPiecePrefix = playerSide === "black" ? "b" : "w";
                if (!piece.pieceType.startsWith(currentPiecePrefix)) return false;
                return isPlayableRoom;
              },
              onSquareClick,
              onSquareRightClick: () => {
                setPremove(null);
                setPendingConfirmMove(null);
                setSelectedSquare(null);
              },
              onMouseOverSquare: ({ square }) => setHoverSquare(square),
              onMouseOutSquare: () => setHoverSquare(null),
              squareStyles,
              arrows: boardArrows,
              allowDrawingArrows: false,
              allowAutoScroll: false,
              dragActivationDistance: 8,
              showNotation: settings.boardCoordinates,
              showAnimations: settings.animationSpeed > 0,
              animationDurationInMs: animationDuration(settings),
              boardStyle: {
                borderRadius: "1.5rem",
                boxShadow: "0 24px 80px rgba(0,0,0,0.22)",
                overflow: "hidden",
                touchAction: "none",
              },
              lightSquareStyle: { backgroundColor: colors.light },
              darkSquareStyle: { backgroundColor: colors.dark },
            }}
          />

          {pendingPromotion ? (
            <div className="absolute inset-0 z-20 grid place-items-end bg-black/35 p-3 backdrop-blur-[2px] sm:place-items-center sm:p-4">
              <div className="w-full max-w-md rounded-2xl border bg-card/96 p-4 text-card-foreground shadow-2xl sm:p-5">
                <h2 className="text-2xl font-black">Choose promotion</h2>
                <p className="mt-1 text-sm text-muted-foreground">Pick the promotion piece before the move is sent.</p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["q", "Queen"],
                    ["r", "Rook"],
                    ["b", "Bishop"],
                    ["n", "Knight"],
                  ].map(([piece, label]) => (
                    <Button
                      key={piece}
                      variant="secondary"
                      className="h-20 flex-col rounded-2xl px-2"
                      onClick={() => {
                        const confirmed = {
                          from: pendingPromotion.from,
                          to: pendingPromotion.to,
                          promotion: piece as PromotionPiece,
                        };
                        setPendingPromotion(null);
                        if (settings.moveConfirmation) {
                          setPendingConfirmMove(confirmed);
                          setSelectedSquare(null);
                          return;
                        }
                        void makeMove(confirmed.from, confirmed.to, confirmed.promotion);
                      }}
                    >
                      <span className="font-mono text-3xl font-black uppercase">{piece}</span>
                      <span className="mt-1 text-xs">{label}</span>
                    </Button>
                  ))}
                </div>
                <Button variant="ghost" className="mt-3 w-full" onClick={() => setPendingPromotion(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {room?.status === "finished" && finishedGame ? (
            <div className="absolute inset-0 grid place-items-center bg-black/25 p-4 backdrop-blur-[2px]">
              <div className="w-full max-w-md rounded-2xl border bg-card/95 p-5 text-card-foreground shadow-2xl">
                <p className="text-sm font-semibold text-muted-foreground">{room.endReason ?? result.label}</p>
                <h2 className="mt-1 text-3xl font-black">
                  {room.result === "1-0" ? `${whiteMeta.name} won` : room.result === "0-1" ? `${blackMeta.name} won` : "Draw"}
                </h2>
                {typeof viewerRatingDelta === "number" ? (
                  <p className="mt-3 rounded-xl bg-muted p-3 text-center text-sm font-semibold">
                    Rating change: {viewerRatingDelta > 0 ? `+${viewerRatingDelta}` : viewerRatingDelta}
                  </p>
                ) : null}
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button variant="secondary" onClick={() => router.push(`/analysis?id=${finishedGame.id}&autostart=1`)}>
                    <Search className="mr-2 h-4 w-4" />
                    Analyze
                  </Button>
                  <Button variant="secondary" onClick={() => downloadPgn(finishedGame)}>
                    <Download className="mr-2 h-4 w-4" />
                    PGN
                  </Button>
                  <Button variant="secondary" onClick={() => void copyText(finishedGame.pgn || "*", "PGN copied.")}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy PGN
                  </Button>
                  <Button variant="secondary" onClick={() => void copyText(inviteLink, "Room link copied.")}>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void sendRoomAction("request_rematch")}
                    disabled={actionLoading !== "" || Boolean(room.rematchRequestedBy)}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Rematch
                  </Button>
                  <Button variant="secondary" onClick={() => router.push("/play/online")}>
                    New Match
                  </Button>
                </div>
                {!user ? (
                  <LinkButton href="/register" className="mt-3 w-full">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create Account To Save
                  </LinkButton>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <aside className="grid content-start gap-4">
        <Card>
          <div className="flex items-center gap-3">
            {room?.status === "ready" ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            <h2 className="text-xl font-black">Room</h2>
          </div>
          <div className="mt-4 rounded-2xl bg-muted p-3 font-mono text-xs break-all">{inviteLink}</div>
          <Button className="mt-3 w-full" variant="secondary" onClick={() => void copyText(inviteLink, "Invite link copied.")}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Invite Link
          </Button>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-2xl bg-muted p-3">
              <p className="text-muted-foreground">You are</p>
              <p className="font-black">{sideLabel(playerSide)}</p>
            </div>
            <div className="rounded-2xl bg-muted p-3">
              <p className="text-muted-foreground">Status</p>
              <p className="font-black">{room?.status ?? "loading"}</p>
            </div>
          </div>
          {room?.status === "waiting" && playerSide === "spectator" ? (
            <Button className="mt-3 w-full" onClick={() => void joinWaitingRoom()} disabled={actionLoading === "join"}>
              {actionLoading === "join" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Join as Black
            </Button>
          ) : null}
          {room?.gameType === "rated" ? (
            <p className="mt-3 rounded-2xl bg-muted p-3 text-sm font-semibold">
              Rated game. No hints, no undo, and long disconnects can lose the game.
            </p>
          ) : (
            <p className="mt-3 rounded-2xl bg-muted p-3 text-sm font-semibold">
              Casual game. Reconnect still matters, but no rating changes are applied here.
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Premoves: {settings.premoves ? "On" : "Off"} · Confirm moves: {settings.moveConfirmation ? "On" : "Off"} ·
            Auto-queen: {settings.autoQueen ? "On" : "Off"} · Sound: {settings.sounds ? "On" : "Off"}
          </p>
          {isLoadingRoom ? <p className="mt-3 text-sm text-muted-foreground">Loading room...</p> : null}
        </Card>

        <Card>
          <h2 className="text-lg font-black">Game controls</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {room?.status === "waiting" && playerSide === "white" ? (
              <Button variant="danger" onClick={() => void sendRoomAction("cancel")} disabled={actionLoading !== ""}>
                Cancel
              </Button>
            ) : null}
            <Button
              variant="danger"
              onClick={() => setShowResignConfirm(true)}
              disabled={!isPlayableRoom || playerSide === "spectator" || actionLoading !== ""}
            >
              Resign
            </Button>
            <Button
              variant="secondary"
              onClick={() => void sendRoomAction("offer_draw")}
              disabled={!canOfferDraw || actionLoading !== ""}
            >
              Offer Draw
            </Button>
            <Button
              variant="secondary"
              onClick={() => void sendRoomAction("accept_draw")}
              disabled={!canRespondToDraw || actionLoading !== ""}
            >
              Accept Draw
            </Button>
            <Button
              variant="secondary"
              onClick={() => void sendRoomAction("decline_draw")}
              disabled={!canRespondToDraw || actionLoading !== ""}
            >
              Decline Draw
            </Button>
            <Button
              variant="secondary"
              onClick={() => void sendRoomAction("accept_rematch")}
              disabled={room?.status !== "finished" || !room?.rematchRequestedBy || room.rematchRequestedBy === playerSide || actionLoading !== ""}
            >
              Accept Rematch
            </Button>
            {pendingConfirmMove ? (
              <Button variant="primary" onClick={confirmPendingMove} disabled={isMoveSubmitting}>
                Confirm Move
              </Button>
            ) : null}
            {pendingConfirmMove ? (
              <Button variant="ghost" onClick={() => setPendingConfirmMove(null)}>
                Cancel Move
              </Button>
            ) : null}
            {premove ? (
              <Button variant="ghost" onClick={() => setPremove(null)}>
                <X className="mr-2 h-4 w-4" />
                Cancel Premove
              </Button>
            ) : null}
          </div>
          {room?.drawOfferedBy ? (
            <p className="mt-3 rounded-2xl bg-muted p-3 text-sm font-semibold">
              {room.drawOfferedBy === playerSide ? "Waiting for opponent to answer the draw offer." : "Opponent offers a draw."}
            </p>
          ) : null}
          {room?.rematchRequestedBy ? (
            <p className="mt-3 rounded-2xl bg-muted p-3 text-sm font-semibold">
              {room.rematchRequestedBy === playerSide ? "Waiting for opponent to accept rematch." : "Opponent requested a rematch."}
            </p>
          ) : null}
          {!user && room?.status === "finished" ? (
            <LinkButton href="/register" className="mt-3 w-full">
              <Shield className="mr-2 h-4 w-4" />
              Create account to keep this game
            </LinkButton>
          ) : null}
        </Card>

        <Card className="max-h-[34rem] overflow-auto">
          <h2 className="text-lg font-black">Moves</h2>
          {moves.length ? (
            <div className="mt-4 grid grid-cols-[3rem_1fr_1fr] gap-2 text-sm">
              {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, index) => (
                <div key={index} className="contents">
                  <span className="font-mono text-muted-foreground">{index + 1}.</span>
                  <span className="rounded-xl bg-muted px-3 py-2 font-mono">{moves[index * 2]}</span>
                  <span className="rounded-xl bg-muted px-3 py-2 font-mono">{moves[index * 2 + 1] ?? ""}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {room?.status === "waiting" ? "Waiting for the second player to join." : "No moves yet."}
            </p>
          )}
        </Card>
      </aside>

      {showResignConfirm ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-2xl">
            <h2 className="text-2xl font-black">Resign?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Are you sure you want to resign?</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="danger" onClick={() => void sendRoomAction("resign")} disabled={actionLoading !== ""}>
                Confirm
              </Button>
              <Button variant="secondary" onClick={() => setShowResignConfirm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function FriendPage() {
  return (
    <Suspense fallback={<Card>Loading room...</Card>}>
      <FriendClient />
    </Suspense>
  );
}
