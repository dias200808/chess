"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Chess, type Square } from "chess.js";
import { Copy, Link as LinkIcon, Swords, Users } from "lucide-react";
import { BoardStagePreview } from "@/components/board-stage-preview";
import { Chessboard } from "@/components/client-chessboard";
import { ChessGame } from "@/components/chess-game";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card, SelectField } from "@/components/ui";
import type { Room } from "@/lib/types";
import { getGameResult, squareTargets } from "@/lib/chess-utils";
import { getTimeControlPreset, timeControlPresets } from "@/lib/game-config";
import {
  createRoomInSupabase,
  fetchRoomFromSupabase,
  isSupabaseConfigured,
  joinRoomInSupabase,
  subscribeToRoom,
  updateRoomMovesInSupabase,
} from "@/lib/supabase-data";

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

function FriendClient() {
  const params = useSearchParams();
  const { user, authMode } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [moves, setMoves] = useState<string[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [timeControlId, setTimeControlId] = useState("10-0");
  const roomId = params.get("room");
  const canUseRealtime = authMode === "supabase" && isSupabaseConfigured() && user;
  const timeControl = getTimeControlPreset(timeControlId);

  const chess = useMemo(() => replay(moves), [moves]);
  const result = getGameResult(chess);
  const playerColor =
    room?.whiteUserId === user?.id ? "white" : room?.blackUserId === user?.id ? "black" : null;
  const selectedTargets = selectedSquare ? squareTargets(chess.fen(), selectedSquare) : [];

  useEffect(() => {
    if (!roomId || !user || !canUseRealtime) return;
    let channel: ReturnType<typeof subscribeToRoom> | null = null;

    async function joinRoom() {
      if (!roomId || !user) return;
      const joined = await joinRoomInSupabase(roomId, user.id);
      const activeRoom = joined ?? (await fetchRoomFromSupabase(roomId));
      if (!activeRoom) {
        setMessage("Комната не найдена.");
        return;
      }
      setRoom(activeRoom);
      setMoves(activeRoom.moves ?? []);
      channel = subscribeToRoom(activeRoom.id, (nextRoom) => {
        setRoom(nextRoom);
        setMoves(nextRoom.moves ?? []);
      });
    }

    void joinRoom();
    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [canUseRealtime, roomId, user]);

  async function createRoom() {
    if (!user || !canUseRealtime) {
      setRoom({
        id: crypto.randomUUID().slice(0, 8),
        link: `${window.location.origin}/friend`,
        status: "placeholder",
        createdAt: new Date().toISOString(),
      });
      setMessage("Создан локальный режим. Для онлайн-синхронизации подключите Supabase и войдите в аккаунт.");
      return;
    }

    const created = await createRoomInSupabase(user.id);
    if (!created) return;
    setRoom(created);
    setMoves([]);
    setMessage("Комната создана. Отправьте ссылку другу.");
    subscribeToRoom(created.id, (nextRoom) => {
      setRoom(nextRoom);
      setMoves(nextRoom.moves ?? []);
    });
  }

  async function copyLink() {
    if (!room) return;
    await navigator.clipboard.writeText(room.link);
  }

  function canMovePiece(square: string) {
    if (!playerColor || result.result !== "*") return false;
    const piece = chess.get(square as Square);
    if (!piece) return false;
    return playerColor === "white"
      ? piece.color === "w" && chess.turn() === "w"
      : piece.color === "b" && chess.turn() === "b";
  }

  async function makeMove(sourceSquare: string, targetSquare: string | null) {
    if (!targetSquare || !room || !canMovePiece(sourceSquare)) return false;
    const next = replay(moves);
    try {
      const move = next.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      const nextMoves = [...moves, move.san];
      setMoves(nextMoves);
      setSelectedSquare(null);
      await updateRoomMovesInSupabase(room.id, nextMoves, next.fen(), getGameResult(next).result);
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
    ...(selectedSquare ? [[selectedSquare, { background: "rgba(96, 197, 141, 0.55)" }]] : []),
    ...selectedTargets.map((target) => [
      target,
      { background: "radial-gradient(circle, rgba(31, 122, 77, 0.46) 24%, transparent 27%)" },
    ]),
  ]);

  return (
    <div className="grid gap-6">
      {!room ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_32rem]">
          <BoardStagePreview
            topLabel="Друг"
            topMeta="Подключится по ссылке"
            bottomLabel="Вы"
            bottomMeta={`${canUseRealtime ? "Онлайн-комната" : "Локальный режим"} • ${timeControl.label}`}
          />

          <section className="grid gap-4 rounded-[1.75rem] border border-white/6 bg-[#262421] p-4 text-[#f4efe4] shadow-2xl shadow-black/20">
            <div className="border-b border-white/6 px-1 pb-4">
              <Badge className="border-[#5f8443] bg-[#4d6a36] text-[#f7f2e7]">
                Игра с другом
              </Badge>
              <h1 className="mt-3 text-4xl font-black text-white">Создайте комнату</h1>
              <p className="mt-2 text-sm leading-6 text-[#beb6a7]">
                Сгенерируйте ссылку, отправьте её другу и начните общую партию. Если
                Supabase уже подключен, ходы будут синхронизироваться в реальном времени.
              </p>
            </div>

            <section className="rounded-[1.6rem] border border-white/7 bg-[#34312d] p-5">
              <div className="flex items-start gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#4d6a36] text-white">
                  <Users className="h-7 w-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-black text-white">Комната партии</h2>
                  <p className="mt-2 text-sm leading-6 text-[#c8c1b3]">
                    Один клик для создания комнаты, затем ссылка для приглашения и старт
                    партии после подключения второго игрока.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <SelectField
                      label="Контроль времени"
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
                    <Button onClick={createRoom}>
                      <LinkIcon className="mr-2 h-4 w-4" />
                      Создать комнату
                    </Button>
                    <a
                      href="/play"
                      className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/6 px-5 text-sm font-semibold text-white transition hover:bg-white/12"
                    >
                      <Swords className="mr-2 h-4 w-4" />
                      Локальная партия
                    </a>
                  </div>
                </div>
              </div>
            </section>

            {message ? <p className="px-1 text-sm text-[#beb6a7]">{message}</p> : null}
          </section>
        </div>
      ) : (
        <Card>
          <Badge>{canUseRealtime ? "Supabase Realtime" : "Локальный режим"}</Badge>
          <h1 className="mt-3 text-3xl font-black">Комната с другом</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Скопируйте ссылку и отправьте ее другу. После подключения второго игрока
            ходы будут синхронизироваться в этой комнате.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={copyLink}>
              <Copy className="mr-2 h-4 w-4" />
              Копировать ссылку
            </Button>
          </div>
          <div className="mt-4 grid gap-3 rounded-2xl border bg-muted p-4 text-sm">
            <div className="font-mono break-all">{room.link}</div>
            <div className="flex flex-wrap gap-2">
              <Badge>{room.status}</Badge>
              <Badge>Ваша сторона: {playerColor ?? "наблюдатель"}</Badge>
              <Badge>{result.label}</Badge>
            </div>
          </div>
          {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
        </Card>
      )}

      {room && canUseRealtime ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card className="p-3 sm:p-5">
            <div className="mx-auto max-w-[min(82vh,720px)]">
              <Chessboard
                options={{
                  position: chess.fen(),
                  boardOrientation: playerColor ?? "white",
                  onPieceDrop: ({ sourceSquare, targetSquare }) => {
                    void makeMove(sourceSquare, targetSquare);
                    return true;
                  },
                  onSquareClick,
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
          <Card>
            <Users className="h-5 w-5 text-primary" />
            <h2 className="mt-3 text-xl font-black">Синхронизированные ходы</h2>
            <div className="mt-4 grid grid-cols-[3rem_1fr_1fr] gap-2 text-sm">
              {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, index) => (
                <div key={index} className="contents">
                  <span className="font-mono text-muted-foreground">{index + 1}.</span>
                  <span className="rounded-xl bg-muted px-3 py-2 font-mono">{moves[index * 2]}</span>
                  <span className="rounded-xl bg-muted px-3 py-2 font-mono">{moves[index * 2 + 1] ?? ""}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <ChessGame mode="friend" timeControl={timeControl} />
      )}
    </div>
  );
}

export default function FriendPage() {
  return (
    <Suspense fallback={<Card>Загрузка комнаты...</Card>}>
      <FriendClient />
    </Suspense>
  );
}
