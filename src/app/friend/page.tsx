"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Chess, type Square } from "chess.js";
import { CheckCircle2, Copy, Link as LinkIcon, Loader2, Swords, Users } from "lucide-react";
import { BoardStagePreview } from "@/components/board-stage-preview";
import { Chessboard } from "@/components/client-chessboard";
import { Badge, Button, Card, SelectField } from "@/components/ui";
import type { Room } from "@/lib/types";
import { getGameResult, squareTargets } from "@/lib/chess-utils";
import { getTimeControlPreset, timeControlPresets } from "@/lib/game-config";
import {
  createGuestRoomInSupabase,
  fetchRoomFromSupabase,
  isSupabaseConfigured,
  joinGuestRoomInSupabase,
  subscribeToRoom,
  updateRoomMovesInSupabase,
} from "@/lib/supabase-data";

type OnlineSide = "white" | "black" | "spectator";

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

function roomSideKey(roomId: string) {
  return `knightly-room:${roomId}:side`;
}

function sideLabel(side: OnlineSide | null) {
  if (side === "white") return "White";
  if (side === "black") return "Black";
  if (side === "spectator") return "Spectator";
  return "Not joined";
}

function FriendClient() {
  const params = useSearchParams();
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [moves, setMoves] = useState<string[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [timeControlId, setTimeControlId] = useState("10-0");
  const [playerSide, setPlayerSide] = useState<OnlineSide | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingRoom, setIsLoadingRoom] = useState(false);
  const roomId = params.get("room");
  const canUseRealtime = isSupabaseConfigured();
  const timeControl = getTimeControlPreset(room?.timeControl ?? timeControlId);

  const chess = useMemo(() => replay(moves), [moves]);
  const result = getGameResult(chess);
  const selectedTargets = selectedSquare ? squareTargets(chess.fen(), selectedSquare) : [];
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const inviteLink = room?.link || (roomId && origin ? `${origin}/friend?room=${roomId}` : "");
  const isPlayableRoom = room?.status === "ready" && result.result === "*";
  const currentTurnSide = chess.turn() === "w" ? "white" : "black";
  const turnText = result.result === "*" ? `${currentTurnSide === "white" ? "White" : "Black"} to move` : result.label;

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

      if (!side) {
        if (activeRoom.status === "waiting") {
          side = "black";
          localStorage.setItem(roomSideKey(activeRoom.id), side);
          try {
            joinedRoom = (await joinGuestRoomInSupabase(activeRoom.id)) ?? activeRoom;
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
  }, [canUseRealtime, roomId]);

  async function createRoom() {
    if (!canUseRealtime) {
      setMessage("Supabase is not configured, so this page cannot sync online moves yet.");
      return;
    }

    setIsCreating(true);
    setMessage("");
    let created: Room | null = null;
    try {
      created = await createGuestRoomInSupabase(timeControlId);
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

  function canMovePiece(square: string) {
    if (!room || !isPlayableRoom || playerSide === "spectator") return false;
    if (playerSide !== currentTurnSide) return false;
    const piece = chess.get(square as Square);
    if (!piece) return false;
    return playerSide === "white" ? piece.color === "w" : piece.color === "b";
  }

  async function makeMove(sourceSquare: string, targetSquare: string | null) {
    if (!targetSquare || !room || !canMovePiece(sourceSquare)) return false;
    if (!squareTargets(chess.fen(), sourceSquare).includes(targetSquare as Square)) return false;

    const next = replay(moves);
    try {
      const move = next.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      const nextMoves = [...moves, move.san];
      setMoves(nextMoves);
      setSelectedSquare(null);
      const nextRoom = await updateRoomMovesInSupabase(
        room.id,
        nextMoves,
        next.fen(),
        getGameResult(next).result,
      );
      if (nextRoom) setRoom(nextRoom);
      return true;
    } catch {
      return false;
    }
  }

  function onSquareClick({ square }: { square: string }) {
    if (selectedSquare && selectedTargets.includes(square as Square)) {
      void makeMove(selectedSquare, square);
      return;
    }
    setSelectedSquare(canMovePiece(square) ? square : null);
  }

  const squareStyles = Object.fromEntries([
    ...(selectedSquare ? [[selectedSquare, { background: "rgba(34, 211, 238, 0.42)" }]] : []),
    ...selectedTargets.map((target) => [
      target,
      {
        background:
          "radial-gradient(circle, rgba(14, 165, 233, 0.92) 16%, rgba(255, 255, 255, 0.9) 18%, transparent 23%)",
      },
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
            <div className="mx-auto max-w-[min(82vh,720px)]">
              <Chessboard
                options={{
                  position: chess.fen(),
                  boardOrientation: playerSide === "black" ? "black" : "white",
                  onPieceDrop: ({ sourceSquare, targetSquare }) => {
                    if (!targetSquare) return false;
                    if (!canMovePiece(sourceSquare)) return false;
                    if (!squareTargets(chess.fen(), sourceSquare).includes(targetSquare as Square)) return false;
                    void makeMove(sourceSquare, targetSquare);
                    return true;
                  },
                  onSquareClick,
                  onMouseOverSquare: ({ square }) => {
                    if (canMovePiece(square)) setSelectedSquare(square);
                  },
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
