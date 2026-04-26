"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import { Badge, Button, Card, SelectField } from "@/components/ui";
import { getSettings, setSettings } from "@/lib/storage";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();
  const [settings, setLocalSettings] = useState(() => getSettings());

  function update(next: typeof settings) {
    setLocalSettings(next);
    setSettings(next);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <Badge>Preferences</Badge>
        <h1 className="mt-2 text-3xl font-black">Settings</h1>
        <div className="mt-6 grid gap-5">
          <SelectField label="Theme" value={theme} onChange={(event) => setTheme(event.target.value as "light" | "dark" | "system")}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </SelectField>
          <SelectField label="Board style" value={settings.boardStyle} onChange={(event) => update({ ...settings, boardStyle: event.target.value })}>
            <option value="forest">Forest</option>
            <option value="sand">Sand</option>
            <option value="classic">Classic</option>
          </SelectField>
          <SelectField label="Piece style" value={settings.pieceStyle} onChange={(event) => update({ ...settings, pieceStyle: event.target.value })}>
            <option value="classic">Classic</option>
            <option value="modern">Modern</option>
          </SelectField>
          <label className="flex items-center justify-between rounded-2xl border bg-muted p-4 font-medium">
            Move sounds
            <input type="checkbox" checked={settings.sounds} onChange={(event) => update({ ...settings, sounds: event.target.checked })} />
          </label>
          <Button variant="danger" onClick={logout}>Log out</Button>
        </div>
      </Card>
    </div>
  );
}
