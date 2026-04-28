"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  Clock3,
  Gauge,
  Globe2,
  Grid2x2,
  Link2,
  Loader2,
  LogIn,
  Shield,
  Timer,
  Trophy,
  User2,
  UserPlus,
  Users,
} from "lucide-react";
import { Chessboard } from "@/components/client-chessboard";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Field, LinkButton } from "@/components/ui";
import { START_FEN, getTimeControlPreset, isGuestOnlineTimeControl, timeControlPresets } from "@/lib/game-config";
import { getOnlinePlayerKey, getOnlinePlayerName, roomSideKey, setGuestOnlinePlayerName } from "@/lib/online-player";
import { ratingForProfile, ratingTypeForTimeControl, ratingTypeLabels } from "@/lib/rating";
import { isSupabaseConfigured } from "@/lib/supabase-data";

const TIME_GROUPS = [
  { key: "bullet", label: "Bullet", icon: Gauge, ids: ["1-0", "1-1"] },
  { key: "blitz", label: "Blitz", icon: Timer, ids: ["3-0", "3-2", "5-0", "5-3"] },
  { key: "rapid", label: "Rapid", icon: Clock3, ids: ["10-0", "10-5", "15-10", "30-0"] },
] as const;

function subscribeToNothing() {
  return () => {};
}

function getSpeedLabel(id: string) {
  if (id.startsWith("1-")) return "Bullet";
  if (id.startsWith("3-") || id.startsWith("5-")) return "Blitz";
  if (id.startsWith("10-") || id.startsWith("15-") || id.startsWith("30-")) return "Rapid";
  return "Standard";
}

function formatClock(seconds: number | null) {
  if (seconds === null) return "--:--";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function OnlineBoardPreview({
  playerName,
  guest,
  clockLabel,
}: {
  playerName: string;
  guest: boolean;
  clockLabel: string;
}) {
  return (
    <section className="rounded-[1.35rem] border border-[#4b463f] bg-[#2b2824] p-4 shadow-[0_20px_55px_rgba(0,0,0,0.26)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-md bg-[#46413b] text-[#d7cfbf]">
            <User2 className="h-7 w-7" />
          </div>
          <div>
            <p className="text-2xl font-black text-white">Opponent</p>
            <p className="text-sm text-[#b6ad9d]">Searching for a live game</p>
          </div>
        </div>
        <div className="rounded-md bg-[#3a3632] px-6 py-2 text-4xl font-black tracking-tight text-[#a9a19a]">
          {clockLabel}
        </div>
      </div>

      <div className="overflow-hidden rounded-sm">
        <Chessboard
          options={{
            id: "knightly-online-preview-board",
            position: START_FEN,
            allowDragging: false,
            showNotation: true,
            showAnimations: false,
            boardStyle: {
              overflow: "hidden",
            },
            lightSquareStyle: { backgroundColor: "#eeeed2" },
            darkSquareStyle: { backgroundColor: "#769656" },
            alphaNotationStyle: { color: "#d7d772", fontWeight: 800, fontSize: "1.15rem" },
            numericNotationStyle: { color: "#d7d772", fontWeight: 800, fontSize: "1.15rem" },
          }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-md bg-[#d9d5cd] text-[#73695a]">
            <User2 className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-2xl font-black text-white">{playerName}</p>
            <p className="text-sm text-[#d2c8b5]">{guest ? "Guest casual queue" : "Signed-in online queue"}</p>
          </div>
        </div>
        <div className="rounded-md bg-[#b8b5b2] px-6 py-2 text-4xl font-black tracking-tight text-[#615e5d]">
          {clockLabel}
        </div>
      </div>
    </section>
  );
}

function TopTab({
  label,
  icon: Icon,
  active = false,
}: {
  label: string;
  icon: typeof Globe2;
  active?: boolean;
}) {
  return (
    <div
      className={`grid flex-1 place-items-center gap-2 rounded-xl px-3 py-3 text-center ${
        active ? "bg-[#2f2b27] text-white" : "text-[#beb4a0]"
      }`}
    >
      <Icon className="h-6 w-6" />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}

function TimeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-lg font-black transition ${
        active
          ? "border-[#80c34d] bg-[#35322d] text-white shadow-[inset_0_0_0_1px_rgba(128,195,77,0.55)]"
          : "border-[#4d4841] bg-[linear-gradient(180deg,#44403b_0%,#39352f_100%)] text-[#f0e7d8] hover:brightness-110"
      }`}
    >
      {label}
    </button>
  );
}

export default function OnlinePlayPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [gameType, setGameType] = useState<"casual" | "rated">("casual");
  const [timeControlId, setTimeControlId] = useState("10-0");
  const storedGuestName = useSyncExternalStore(
    subscribeToNothing,
    () => getOnlinePlayerName(null),
    () => "Guest",
  );
  const [guestNameDraft, setGuestNameDraft] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState<null | "quick" | "invite">(null);
  const guestName = guestNameDraft ?? storedGuestName;

  const availableControls = useMemo(
    () =>
      timeControlPresets.filter(
        (item) => item.initialSeconds !== null && (user || isGuestOnlineTimeControl(item.id)),
      ),
    [user],
  );
  const effectiveTimeControlId = availableControls.some((item) => item.id === timeControlId)
    ? timeControlId
    : availableControls[0]?.id ?? "5-0";
  const timeControl = getTimeControlPreset(effectiveTimeControlId);
  const effectiveGameType = user ? gameType : "casual";
  const ratingType = ratingTypeForTimeControl(timeControl);
  const playerRating = user && ratingType ? ratingForProfile(user, ratingType) : null;
  const clockLabel = formatClock(timeControl.initialSeconds);
  const selectedSpeedLabel = getSpeedLabel(effectiveTimeControlId);
  const playerName = user?.username ?? guestName;
  const ratingCards = user
    ? [
        { key: "bullet", label: ratingTypeLabels.bullet, value: ratingForProfile(user, "bullet") },
        { key: "blitz", label: ratingTypeLabels.blitz, value: ratingForProfile(user, "blitz") },
        { key: "rapid", label: ratingTypeLabels.rapid, value: ratingForProfile(user, "rapid") },
        { key: "classical", label: ratingTypeLabels.classical, value: ratingForProfile(user, "classical") },
      ]
    : [];
  const timeGroups = TIME_GROUPS.map((group) => ({
    ...group,
    items: group.ids
      .map((id) => availableControls.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
  })).filter((group) => group.items.length > 0);

  async function createRoom(endpoint: "/api/rooms/quick" | "/api/rooms/invite") {
    if (!isSupabaseConfigured()) {
      setMessage("Online play needs Supabase env vars and the latest room schema.");
      return;
    }

    if (!user) {
      const trimmed = guestName.trim();
      if (!trimmed) {
        setMessage("Choose a temporary guest name before starting.");
        return;
      }
      setGuestOnlinePlayerName(trimmed);
    }

    setIsLoading(endpoint === "/api/rooms/quick" ? "quick" : "invite");
    setMessage(endpoint === "/api/rooms/quick" ? "Searching for an opponent..." : "Creating invite room...");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeControl: effectiveTimeControlId,
          playerKey: getOnlinePlayerKey(user?.id),
          playerType: user ? "account" : "guest",
          userId: user?.id ?? null,
          username: user?.username ?? guestName,
          gameType: effectiveGameType,
          rating: playerRating,
        }),
      });
      const payload = (await response.json()) as {
        room?: { id: string };
        side?: "white" | "black";
        error?: string;
      };

      if (!response.ok || !payload.room || !payload.side) {
        setMessage(payload.error ?? "Could not create the room.");
        setIsLoading(null);
        return;
      }

      localStorage.setItem(roomSideKey(payload.room.id), payload.side);
      router.push(`/friend?room=${payload.room.id}`);
    } catch {
      setMessage("Could not reach the online room service.");
      setIsLoading(null);
    }
  }

  return (
    <section className="rounded-[1.4rem] border border-[#4a453f] bg-[#2e2b27] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.22)] lg:p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_30rem]">
        <div className="min-w-0">
          <OnlineBoardPreview playerName={playerName} guest={!user} clockLabel={clockLabel} />

          {!user ? (
            <div className="mt-4 rounded-[1.1rem] border border-[#4a453f] bg-[#26231f] p-4 text-[#f2eadc]">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[16rem] flex-1">
                  <Field
                    label="Guest name"
                    value={guestName}
                    className="border-[#4f4a44] bg-[#171512] text-white"
                    onChange={(event) => setGuestNameDraft(event.target.value)}
                    maxLength={24}
                  />
                </div>
                <Button
                  variant="secondary"
                  className="border-[#4d4842] bg-[#35312d] text-[#f2eadc] hover:bg-[#403b36]"
                  onClick={() => setGuestOnlinePlayerName(guestName)}
                >
                  Save name
                </Button>
                <div className="rounded-full border border-[#504a43] bg-[#312d28] px-4 py-2 text-sm text-[#c8bfaf]">
                  Guests can join casual only
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[1.1rem] border border-[#4a453f] bg-[#26231f] px-4 py-3 text-[#f4ecde]">
              <Badge className="border-[#545048] bg-[#34302b] text-[#ede3d1]">Signed in</Badge>
              <span className="text-lg font-black">{user.username}</span>
              <span className="text-sm text-[#c0b6a5]">
                Rated queue available{playerRating ? ` | ${playerRating} ${selectedSpeedLabel.toLowerCase()}` : ""}
              </span>
            </div>
          )}
        </div>

        <section className="rounded-[1.35rem] border border-[#45403a] bg-[#24211d] p-4 text-[#fff7eb] shadow-[0_20px_55px_rgba(0,0,0,0.2)]">
          <div className="grid grid-cols-3 gap-3 border-b border-white/6 pb-4">
            <TopTab label="New Game" icon={Globe2} active />
            <TopTab label="Games" icon={Grid2x2} />
            <TopTab label="Players" icon={Users} />
          </div>

          <div className="mt-4 rounded-[1.15rem] border border-[#4c4841] bg-[linear-gradient(180deg,#4a4641_0%,#3b3732_100%)] px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-[#2c2a25] text-[#8bc34a]">
                <Clock3 className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-[#bdb29f]">{selectedSpeedLabel}</p>
                <p className="text-4xl font-black text-white">{timeControl.label}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-xl font-black text-white">Mode</p>
              <p className="text-sm text-[#c1b7a6]">
                {user ? "Choose casual or rated before searching." : "Guests stay in casual matchmaking."}
              </p>
            </div>
            <div className="inline-flex rounded-full border border-[#4c4841] bg-[#2f2b27] p-1">
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-black transition ${
                  effectiveGameType === "casual" ? "bg-[#6ead47] text-white" : "text-[#d7cdbb]"
                }`}
                onClick={() => setGameType("casual")}
              >
                Casual
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-black transition ${
                  effectiveGameType === "rated" ? "bg-[#6ead47] text-white" : "text-[#7f786d]"
                }`}
                onClick={() => user && setGameType("rated")}
                disabled={!user}
              >
                Rated
              </button>
            </div>
          </div>

          {user ? (
            <div className="mt-4 rounded-[1rem] border border-[#4d4841] bg-[#2c2925] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-[#b9ae9d]">Selected rating</p>
                  <p className="text-2xl font-black text-white">
                    {playerRating ?? "—"} {ratingType ? ratingTypeLabels[ratingType] : "Unrated"}
                  </p>
                </div>
                <div className="text-right text-sm text-[#c8bead]">
                  <p>{timeControl.label}</p>
                  <p>{effectiveGameType === "rated" ? "Rated queue" : "Casual queue"}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {ratingCards.map((item) => (
                  <div
                    key={item.key}
                    className={`rounded-xl border px-3 py-2 ${
                      item.key === ratingType
                        ? "border-[#80c34d] bg-[#31372a] text-white"
                        : "border-[#49443d] bg-[#26231f] text-[#dfd4c4]"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.18em]">{item.label}</p>
                    <p className="mt-1 text-lg font-black">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-4">
            {timeGroups.map((group) => {
              const Icon = group.icon;

              return (
                <div key={group.key}>
                  <div className="mb-2 flex items-center gap-2 text-[#d9cfbf]">
                    <Icon className="h-5 w-5 text-[#8bc34a]" />
                    <span className="text-xl font-black">{group.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {group.items.map((item) => (
                      <TimeButton
                        key={item.id}
                        label={item.label}
                        active={item.id === effectiveTimeControlId}
                        onClick={() => setTimeControlId(item.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            className="mt-5 h-16 w-full rounded-2xl bg-[linear-gradient(180deg,#8dc84f_0%,#6ba83f_100%)] text-2xl font-black text-white shadow-[0_16px_35px_rgba(124,186,77,0.28)]"
            onClick={() => void createRoom("/api/rooms/quick")}
            disabled={isLoading !== null}
          >
            {isLoading === "quick" ? (
              <>
                <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                Searching...
              </>
            ) : (
              "Start Game"
            )}
          </Button>

          <div className="mt-5 grid gap-3">
            <Button
              variant="secondary"
              className="h-16 rounded-2xl border-[#4d4841] bg-[linear-gradient(180deg,#44403b_0%,#39352f_100%)] text-xl font-black text-[#fff7eb] hover:bg-[#403b36]"
              onClick={() => void createRoom("/api/rooms/invite")}
              disabled={isLoading !== null}
            >
              {isLoading === "invite" ? (
                <>
                  <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                  Creating invite...
                </>
              ) : (
                <>
                  <Link2 className="mr-3 h-5 w-5" />
                  Custom Challenge
                </>
              )}
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/history"
                className="inline-flex h-14 items-center justify-center rounded-2xl border border-[#4d4841] bg-[linear-gradient(180deg,#403c37_0%,#35312d_100%)] px-4 text-lg font-black text-[#fff7eb] transition hover:brightness-110"
              >
                Games
              </Link>
              <Link
                href="/leaderboard"
                className="inline-flex h-14 items-center justify-center rounded-2xl border border-[#4d4841] bg-[linear-gradient(180deg,#403c37_0%,#35312d_100%)] px-4 text-lg font-black text-[#fff7eb] transition hover:brightness-110"
              >
                Leaderboard
              </Link>
            </div>
          </div>

          {!user ? (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <LinkButton
                href="/login"
                variant="secondary"
                className="h-12 rounded-xl border-[#4d4841] bg-[#37332f] text-[#fff7eb] hover:bg-[#413c37]"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Log In
              </LinkButton>
              <LinkButton
                href="/register"
                className="h-12 rounded-xl bg-[linear-gradient(180deg,#8cc64e_0%,#6ba73f_100%)] text-white"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Sign Up
              </LinkButton>
            </div>
          ) : (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#4d4841] bg-[#312d28] px-4 py-2 text-sm text-[#d8cdbd]">
              <Shield className="h-4 w-4 text-[#8bc34a]" />
              Rated games update leaderboard and saved stats.
            </div>
          )}

          {message ? (
            <p className="mt-5 rounded-2xl border border-[#4d4841] bg-[#312d28] px-4 py-3 text-sm text-[#ddd2c1]">
              {message}
            </p>
          ) : null}

          <div className="mt-6 flex items-end justify-between gap-3 border-t border-white/6 pt-4 text-[#d9cfbf]">
            <div>
              <p className="text-3xl font-black text-white">{effectiveGameType === "rated" && user ? "Rated" : "Casual"}</p>
              <p className="text-sm text-[#b8ae9d]">
                {user ? `${selectedSpeedLabel} matchmaking with reconnect support` : "Guest online with casual-only access"}
              </p>
            </div>
            <div className="text-right text-sm font-semibold text-[#c8bead]">
              <p className="text-xl font-black text-white">{timeControl.label}</p>
              <p>Ready to queue</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-semibold text-[#c6bba9]">
            <span className="inline-flex items-center gap-2">
              <Users className="h-4 w-4" />
              Live matchmaking
            </span>
            <span className="inline-flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Leaderboard ready
            </span>
            <span className="inline-flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Invite links
            </span>
          </div>
        </section>
      </div>
    </section>
  );
}
