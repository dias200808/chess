"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import { Badge, Button, Card, SelectField } from "@/components/ui";
import { defaultSettings, getSettings, setSettings } from "@/lib/storage";
import type { ChessSettings } from "@/lib/types";

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-16 cursor-pointer touch-manipulation items-center justify-between gap-4 rounded-2xl border bg-muted p-4 font-medium active:scale-[0.99]">
      <span className="min-w-0 break-words">{label}</span>
      <input
        className="h-6 w-6 shrink-0 cursor-pointer"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();
  const [settings, setLocalSettings] = useState<ChessSettings>(() => getSettings());
  const [status, setStatus] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  function update(next: ChessSettings) {
    setLocalSettings(next);
    setSettings(next);
  }

  function resetSettings() {
    update({ ...defaultSettings });
    setStatus("Settings reset.");
  }

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setStatus("Logging out...");
    try {
      await logout();
      router.replace("/");
      router.refresh();
    } catch {
      setStatus("Could not log out. Try again.");
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-4 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:gap-6 lg:grid-cols-[1fr_1fr]">
      <Card>
        <Badge>Appearance</Badge>
        <h1 className="mt-2 text-3xl font-black">Settings</h1>
        <div className="mt-6 grid gap-5">
          <SelectField label="Theme" value={theme} onChange={(event) => setTheme(event.target.value as "light" | "dark" | "system")}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </SelectField>
          <SelectField label="Board theme" value={settings.boardStyle} onChange={(event) => update({ ...settings, boardStyle: event.target.value as ChessSettings["boardStyle"] })}>
            <option value="forest">Forest</option>
            <option value="sand">Sand</option>
            <option value="classic">Classic</option>
            <option value="blue">Blue</option>
            <option value="mono">Mono</option>
          </SelectField>
          <SelectField label="Piece theme" value={settings.pieceStyle} onChange={(event) => update({ ...settings, pieceStyle: event.target.value as ChessSettings["pieceStyle"] })}>
            <option value="classic">Classic</option>
            <option value="modern">Modern</option>
            <option value="alpha">Alpha</option>
          </SelectField>
          <SelectField label="Background theme" value={settings.backgroundTheme} onChange={(event) => update({ ...settings, backgroundTheme: event.target.value as ChessSettings["backgroundTheme"] })}>
            <option value="arena">Arena</option>
            <option value="plain">Plain</option>
            <option value="wood">Wood</option>
            <option value="midnight">Midnight</option>
          </SelectField>
          <label className="grid gap-2 text-sm font-medium">
            <span>Animation speed: {settings.animationSpeed}ms</span>
            <input
              type="range"
              min="0"
              max="600"
              step="30"
              value={settings.animationSpeed}
              onChange={(event) => update({ ...settings, animationSpeed: Number(event.target.value) })}
            />
          </label>
        </div>
      </Card>

      <Card>
        <Badge>Gameplay</Badge>
        <h2 className="mt-2 text-3xl font-black">Board behavior</h2>
        <div className="mt-6 grid gap-3">
          <Toggle label="Sound on/off" checked={settings.sounds} onChange={(sounds) => update({ ...settings, sounds })} />
          <Toggle label="Board coordinates" checked={settings.boardCoordinates} onChange={(boardCoordinates) => update({ ...settings, boardCoordinates })} />
          <Toggle label="Legal moves" checked={settings.legalMoves} onChange={(legalMoves) => update({ ...settings, legalMoves })} />
          <Toggle label="Last move highlight" checked={settings.lastMoveHighlight} onChange={(lastMoveHighlight) => update({ ...settings, lastMoveHighlight })} />
          <Toggle label="Auto-queen" checked={settings.autoQueen} onChange={(autoQueen) => update({ ...settings, autoQueen })} />
          <Toggle label="Premoves" checked={settings.premoves} onChange={(premoves) => update({ ...settings, premoves })} />
          <Toggle label="Move confirmation" checked={settings.moveConfirmation} onChange={(moveConfirmation) => update({ ...settings, moveConfirmation })} />
          <Toggle label="Zen mode" checked={settings.zenMode} onChange={(zenMode) => update({ ...settings, zenMode })} />
          {status ? <p className="mt-2 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">{status}</p> : null}
          <div className="sticky bottom-3 z-10 mt-3 grid gap-3 rounded-[1.5rem] border bg-card/95 p-3 backdrop-blur sm:static sm:grid-cols-2 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-0">
            <Button className="h-12 w-full touch-manipulation" variant="secondary" onClick={resetSettings}>
              Reset settings
            </Button>
            <Button className="h-12 w-full touch-manipulation" variant="danger" onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? "Logging out..." : "Log out"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
