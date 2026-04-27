"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Chess, type Square } from "chess.js";
import { CheckCircle2, Copy, Link as LinkIcon, Loader2, Swords, Users } from "lucide-react";
import { BoardStagePreview } from "@/components/board-stage-preview";
import { Chessboard } from "@/components/client-chessboard";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card, SelectField } from "@/components/ui";
import type { Room } from "@/lib/types";
import { getGameResult, squareTargets } from "@/lib/chess-utils";
import { getTimeControlPreset, timeControlPresets } from "@/lib/game-config";
import { getOnlinePlayerKey, roomSideKey } from "@/lib/online-player";
import {
  createGuestRoomInSupabase,
  fetchRoomFromSupabase,
  isSupabaseConfigured,
  joinGuestRoomInSupabase,
  subscribeToRoom,
} from "@/lib/supabase-data";

type OnlineSide = "white" | "black" | "spectator";
type PromotionPiece = "q" | "r" | "b" | "n";
type PendingPromotion = {
  from: string;
  to: string;
  side: "white" | "black";
};

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

function sideLabel(side: OnlineSide | null) {
  if (side === "white") return "White";
  if (side === "black") return "Black";
  if (side === "spectator") return "Spectator";
  return "Not joined";
}

function formatClock(ms?: number | null) {
  if (ms === null || ms === undefined) return "--:--";
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function isStale(timestamp: string | null | undefined, nowMs: number) {
  if (!nowMs) return false;
  if (!timestamp) return true;
  return nowMs - new Date(timestamp).getTime() > 20_000;
}

function FriendClient() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [moves, setMoves] = useState<string[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [hoverSquare, setHoverSquare] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [timeControlId, setTimeControlId] = useState("10-0");
  const [playerSide, setPlayerSide] = useState<OnlineSide | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingRoom, setIsLoadingRoom] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const roomId = params.get("room");
  const canUseRealtime = isSupabaseConfigured();
  const timeControl = getTimeControlPreset(room?.timeControl ?? timeControlId);

  const chess = useMemo(() => replay(moves), [moves]);
  const result = getGameResult(chess);
  const selectedTargets = selectedSquare ? squareTargets(chess.fen(), selectedSquare) : [];
  const hoverTargets =
    !selectedSquare && hoverSquare && canMovePiece(hoverSquare)
      ? squareTargets(chess.fen(), hoverSquare)
      : [];
  const visibleTargets = selectedSquare ? selectedTargets : hoverTargets;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const inviteLink = room?.link || (roomId && origin ? `${origin}/friend?room=${roomId}` : "");
  const activeRoomId = room?.id;
  const roomResult = room?.result && room.result !== "*" ? room.result : result.result;
  const isPlayableRoom = room?.status === "ready" && roomResult === "*";
  const currentTurnSide = chess.turn() === "w" ? "white" : "black";
  const turnText =
    room?.endReason ??
    (roomResult === "*" ? `${currentTurnSide === "white" ? "White" : "Black"} to move` : result.label);
  const opponentDisconnected =
    room?.status === "ready" &&
    playerSide !== "spectator" &&
    (playerSide === "white" ? isStale(room.blackConnectedAt, nowMs) : isStale(room.whiteConnectedAt, nowMs));

  function liveClock(side: "white" | "black") {
    if (!room) return null;
    const base = side === "white" ? room.whiteTimeMs : room.blackTimeMs;
    if (base === null || base === undefined) return null;
    if (room.status !== "ready" || roomResult !== "*" || currentTurnSide !== side || !room.lastMoveAt) {
      return base;
    }
    return Math.max(0, base - Math.max(0, nowMs - new Date(room.lastMoveAt).getTime()));
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    if (!canUseRealtime) return;

    let disposed = false;
    let channel: ReturnType<typeof subscribeToRoom> | null = null;

    async function openRoom() {
      if (!roomId) return;
      setIsLoadingRoom(true);
      setMessage("");

      let activeRoom: Room | null = null;
      try {
        activeRoom = await fetchRoomFromSupabase(roomId);
      } catch {
        if (!disposed) {
          setMessage("Could not load the room. Check Supabase room policies.");
          setIsLoadingRoom(false);
        }
        return;
      }
      if (!activeRoom) {
        if (!disposed) {
          setRoom(null);
          setPlayerSide(null);
          setMessage("Room not found. Create a new invite link.");
          setIsLoadingRoom(false);
        }
        return;
      }

      let side = localStorage.getItem(roomSideKey(activeRoom.id)) as OnlineSide | null;
      let joinedRoom = activeRoom;
      const playerKey = getOnlinePlayerKey(user?.id);

      if (!side) {
        if (activeRoom.hostKey === playerKey) {
          side = "white";
          localStorage.setItem(roomSideKey(activeRoom.id), side);
        } else if (activeRoom.guestKey === playerKey) {
          side = "black";
          localStorage.setItem(roomSideKey(activeRoom.id), side);
        } else if (activeRoom.status === "waiting") {
          side = "black";
          localStorage.setItem(roomSideKey(activeRoom.id), side);
          try {
            joinedRoom = (await joinGuestRoomInSupabase(activeRoom.id, playerKey)) ?? activeRoom;
          } catch {
            if (!disposed) setMessage("Could not join the room. Check Supabase update policy.");
            joinedRoom = activeRoom;
            side = "spectator";
          }
        } else {
          side = "spectator";
        }
      }

      if (disposed) return;
      setPlayerSide(side);
      setRoom(joinedRoom);
      setMoves(joinedRoom.moves ?? []);
      if (joinedRoom.timeControl) setTimeControlId(joinedRoom.timeControl);
      setIsLoadingRoom(false);

      channel = subscribeToRoom(joinedRoom.id, (nextRoom) => {
        setRoom(nextRoom);
        setMoves(nextRoom.moves ?? []);
        if (nextRoom.timeControl) setTimeControlId(nextRoom.timeControl);
      });
    }

    void openRoom();

    return () => {
      disposed = true;
      if (channel) channel.unsubscribe();
    };
  }, [canUseRealtime, roomId, user?.id]);

  useEffect(() => {
    if (!activeRoomId || playerSide === "spectator" || !playerSide) return;
    let disposed = false;

    async function pingPresence() {
      try {
        const response = await fetch(`/api/rooms/${activeRoomId}/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerKey: getOnlinePlayerKey(user?.id) }),
        });
        const payload = (await response.json()) as { room?: Room };
        if (!disposed && payload.room) setRoom(payload.room);
      } catch {
        // The realtime subscription still keeps the game usable if one heartbeat fails.
      }
    }

    void pingPresence();
    const timer = window.setInterval(() => void pingPresence(), 8000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [activeRoomId, playerSide, user?.id]);

  async function createRoom() {
    if (!canUseRealtime) {
      setMessage("Supabase is not configured, so this page cannot sync online moves yet.");
      return;
    }

    setIsCreating(true);
    setMessage("");
    let created: Room | null = null;
    try {
      created = await createGuestRoomInSupabase(timeControlId, getOnlinePlayerKey(user?.id));
    } catch {
      setMessage("Could not create the room. Run the guest room policies in supabase/schema.sql.");
    }
    setIsCreating(false);

    if (!created) {
      setMessage((current) => current || "Could not create the room. Check Supabase policies and env vars.");
      return;
    }

    localStorage.setItem(roomSideKey(created.id), "white");
    setPlayerSide("white");
    setRoom(created);
    setMoves([]);
    setMessage("Invite room created. Send the link to your friend.");
    router.replace(`/friend?room=${created.id}`);
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setMessage("Invite link copied.");
  }

  async function sendRoomAction(action: "resign" | "offer_draw" | "accept_draw" | "decline_draw" | "cancel") {
    if (!room || !playerSide || playerSide === "spectator") return;
    try {
      const response = await fetch(`/api/rooms/${room.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerKey: getOnlinePlayerKey(user?.id), action }),
      });
      const payload = (await response.json()) as { room?: Room; error?: string };
      if (!response.ok || !payload.room) {
        setMessage(payload.error ?? "Action rejected by server.");
        return;
      }
      setRoom(payload.room);
      setMoves(payload.room.moves ?? []);
      setMessage("");
    } catch {
      setMessage("Could not send action to server.");
    }
  }

  function canMovePiece(square: string) {
    if (!room || !isPlayableRoom || playerSide === "spectator") return false;
    if (playerSide !== currentTurnSide) return false;
    const piece = chess.get(square as Square);
    if (!piece) return false;
    return playerSide === "white" ? piece.color === "w" : piece.color === "b";
  }

  function needsPromotion(sourceSquare: string, targetSquare: string) {
    const piece = chess.get(sourceSquare as Square);
    if (!piece || piece.type !== "p") return false;
    return (
      (piece.color === "w" && targetSquare.endsWith("8")) ||
      (piece.color === "b" && targetSquare.endsWith("1"))
    );
  }

  async function makeMove(sourceSquare: string, targetSquare: string | null, promotion: PromotionPiece = "q") {
    if (!targetSquare || !room || !canMovePiece(sourceSquare)) return false;
    if (!squareTargets(chess.fen(), sourceSquare).includes(targetSquare as Square)) return false;

    try {
      const response = await fetch(`/api/rooms/${room.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerKey: getOnlinePlayerKey(user?.id),
          from: sourceSquare,
          to: targetSquare,
          promotion,
        }),
      });
      const payload = (await response.json()) as { room?: Room; error?: string };
      if (!response.ok || !payload.room) {
        setMessage(payload.error ?? "Move rejected by server.");
        return false;
      }
      setRoom(payload.room);
      setMoves(payload.room.moves ?? []);
      setSelectedSquare(null);
      setHoverSquare(null);
      setPendingPromotion(null);
      return true;
    } catch {
      setMessage("Could not send move to server.");
      return false;
    }
  }

  function onSquareClick({ square }: { square: string }) {
    if (pendingPromotion) return;
    if (selectedSquare && selectedTargets.includes(square as Square)) {
      if (needsPromotion(selectedSquare, square)) {
        setPendingPromotion({
          from: selectedSquare,
          to: square,
          side: chess.turn() === "w" ? "white" : "black",
        });
        return;
      }
      void makeMove(selectedSquare, square);
      return;
    }
    setSelectedSquare(canMovePiece(square) ? square : null);
  }

  const targetStyle = (target: Square) =>
    chess.get(target)
      ? {
          background:
            "radial-gradient(circle, transparent 42%, rgba(248, 113, 113, 0.95) 44%, rgba(248, 113, 113, 0.95) 56%, transparent 58%)",
          boxShadow: "inset 0 0 0 4px rgba(248, 113, 113, 0.7)",
        }
      : {
          background:
            "radial-gradient(circle, rgba(14, 165, 233, 0.92) 16%, rgba(255, 255, 255, 0.9) 18%, transparent 23%)",
        };

  const squareStyles = Object.fromEntries([
    ...(selectedSquare ? [[selectedSquare, { background: "rgba(34, 211, 238, 0.42)" }]] : []),
    ...visibleTargets.map((target) => [
      target,
      targetStyle(target),
    ]),
  ]);

  return (
    <div className="grid gap-6">
      {!room ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_32rem]">
          <BoardStagePreview
            topLabel="Friend"
            topMeta="joins by invite link"
            bottomLabel="You"
            bottomMeta={`Guest online • ${timeControl.label} • unrated`}
          />

          <section className="grid gap-4 rounded-[1.75rem] border border-white/6 bg-[#262421] p-4 text-[#f4efe4] shadow-2xl shadow-black/20">
            <div className="border-b border-white/6 px-1 pb-4">
              <Badge className="border-[#5f8443] bg-[#4d6a36] text-[#f7f2e7]">
                Online friend game
              </Badge>
              <h1 className="mt-3 text-4xl font-black text-white">Play by invite link</h1>
              <p className="mt-2 text-sm leading-6 text-[#beb6a7]">
                Create a room, copy the link, and send it to a friend. No Vercel account, no site
                account, no rating. The first player is White, the invited friend is Black.
              </p>
            </div>

            <section className="rounded-[1.6rem] border border-white/7 bg-[#34312d] p-5">
              <div className="flex items-start gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#4d6a36] text-white">
                  <Users className="h-7 w-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-black text-white">Guest room</h2>
                  <p className="mt-2 text-sm leading-6 text-[#c8c1b3]">
                    Best for quick games with friends. Both players can open the same link from any
                    browser and the moves sync live through Supabase.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <SelectField
                      label="Time control"
                      value={timeControlId}
                      className="min-w-40 border-white/10 bg-[#262421] text-white"
                      onChange={(event) => setTimeControlId(event.target.value)}
                    >
                      {timeControlPresets.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </SelectField>
                    <Button onClick={createRoom} disabled={isCreating || !canUseRealtime} className="self-end">
                      {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                      Create Invite
                    </Button>
                  </div>
                  {!canUseRealtime ? (
                    <p className="mt-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                      Supabase is not configured. Add env vars and run the room policies from
                      supabase/schema.sql for public guest rooms.
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <a
              href="/play"
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/6 px-5 text-sm font-semibold text-white transition hover:bg-white/12"
            >
              <Swords className="mr-2 h-4 w-4" />
              Local game on one device
            </a>

            {message ? <p className="px-1 text-sm text-[#beb6a7]">{message}</p> : null}
          </section>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <Card className="p-3 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge>{room.status === "waiting" ? "Waiting for friend" : "Online room"}</Badge>
                <h1 className="mt-2 text-2xl font-black">Friend game</h1>
                <p className="text-sm text-muted-foreground">{turnText}</p>
              </div>
              <Badge>{timeControl.label} • unrated</Badge>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className={`rounded-2xl p-3 ${currentTurnSide === "black" && isPlayableRoom ? "bg-primary/20 ring-1 ring-primary/40" : "bg-muted"}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Black</p>
                <p className="font-mono text-2xl font-black">{formatClock(liveClock("black"))}</p>
              </div>
              <div className={`rounded-2xl p-3 ${currentTurnSide === "white" && isPlayableRoom ? "bg-primary/20 ring-1 ring-primary/40" : "bg-muted"}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">White</p>
                <p className="font-mono text-2xl font-black">{formatClock(liveClock("white"))}</p>
              </div>
            </div>
            {opponentDisconnected ? (
              <p className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm font-semibold text-red-100">
                Opponent disconnected. Waiting for reconnect...
              </p>
            ) : null}
            <div className="relative mx-auto max-w-[min(82vh,720px)]">
              <Chessboard
                options={{
                  position: chess.fen(),
                  boardOrientation: playerSide === "black" ? "black" : "white",
                  onPieceDrop: ({ sourceSquare, targetSquare }) => {
                    if (pendingPromotion) return false;
                    if (!targetSquare) return false;
                    if (!canMovePiece(sourceSquare)) return false;
                    if (!squareTargets(chess.fen(), sourceSquare).includes(targetSquare as Square)) return false;
                    if (needsPromotion(sourceSquare, targetSquare)) {
                      setPendingPromotion({
                        from: sourceSquare,
                        to: targetSquare,
                        side: chess.turn() === "w" ? "white" : "black",
                      });
                      return false;
                    }
                    void makeMove(sourceSquare, targetSquare);
                    return true;
                  },
                  onSquareClick,
                  onMouseOverSquare: ({ square }) => setHoverSquare(square),
                  onMouseOutSquare: () => setHoverSquare(null),
                  squareStyles,
                  boardStyle: {
                    borderRadius: "1.5rem",
                    boxShadow: "0 24px 80px rgba(0,0,0,0.22)",
                    overflow: "hidden",
                  },
                  lightSquareStyle: { backgroundColor: "#e8d4aa" },
                  darkSquareStyle: { backgroundColor: "#58764a" },
                }}
              />
              {pendingPromotion ? (
                <div className="absolute inset-0 z-20 grid place-items-end bg-black/35 p-3 backdrop-blur-[2px] sm:place-items-center sm:p-4">
                  <div className="w-full max-w-md rounded-2xl border bg-card/96 p-4 text-card-foreground shadow-2xl sm:p-5">
                    <h2 className="text-2xl font-black">Choose promotion</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pawn reached {pendingPromotion.to}. Pick the piece before the move is sent.
                    </p>
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
                          onClick={() =>
                            void makeMove(
                              pendingPromotion.from,
                              pendingPromotion.to,
                              piece as PromotionPiece,
                            )
                          }
                        >
                          <span className="font-mono text-3xl font-black uppercase">{piece}</span>
                          <span className="mt-1 text-xs">{label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <aside className="grid content-start gap-4">
            <Card>
              <div className="flex items-center gap-3">
                {room.status === "ready" ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                <h2 className="text-xl font-black">Invite</h2>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Send this link to a friend. They can join without any account.
              </p>
              <div className="mt-4 rounded-2xl bg-muted p-3 font-mono text-xs break-all">
                {inviteLink}
              </div>
              <Button className="mt-3 w-full" variant="secondary" onClick={copyLink}>
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
                  <p className="font-black">{room.status}</p>
                </div>
              </div>
              {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
              {isLoadingRoom ? <p className="mt-3 text-sm text-muted-foreground">Loading room...</p> : null}
            </Card>

            <Card>
              <h2 className="text-lg font-black">Game controls</h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {room.status === "waiting" && playerSide === "white" ? (
                  <Button variant="danger" onClick={() => void sendRoomAction("cancel")}>
                    Cancel Search
                  </Button>
                ) : null}
                <Button
                  variant="danger"
                  onClick={() => void sendRoomAction("resign")}
                  disabled={!isPlayableRoom || playerSide === "spectator"}
                >
                  Resign
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void sendRoomAction("offer_draw")}
                  disabled={!isPlayableRoom || playerSide === "spectator" || Boolean(room.drawOfferedBy)}
                >
                  Offer Draw
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void sendRoomAction("accept_draw")}
                  disabled={!isPlayableRoom || !room.drawOfferedBy || room.drawOfferedBy === playerSide}
                >
                  Accept Draw
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void sendRoomAction("decline_draw")}
                  disabled={!isPlayableRoom || !room.drawOfferedBy || room.drawOfferedBy === playerSide}
                >
                  Decline Draw
                </Button>
              </div>
              {room.drawOfferedBy ? (
                <p className="mt-3 rounded-2xl bg-muted p-3 text-sm font-semibold">
                  Draw offered by {room.drawOfferedBy}.
                </p>
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
                      <span className="rounded-xl bg-muted px-3 py-2 font-mono">
                        {moves[index * 2 + 1] ?? ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  {room.status === "waiting" ? "Waiting for Black to join." : "No moves yet."}
                </p>
              )}
            </Card>
          </aside>
        </div>
      )}
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
