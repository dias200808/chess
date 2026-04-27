"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Brain,
  Crown,
  Gamepad2,
  GraduationCap,
  History,
  Menu,
  Moon,
  PencilRuler,
  Search,
  Settings,
  Sun,
  Swords,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { backgroundClass } from "@/lib/board-visuals";
import { getSettings } from "@/lib/storage";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui";

const navSections = [
  {
    title: "Игра",
    items: [
      { href: "/play", label: "Играть", icon: Swords },
      { href: "/bot", label: "Боты", icon: Bot },
      { href: "/friend", label: "Друг", icon: Users },
      { href: "/puzzles", label: "Задачи", icon: Brain },
    ],
  },
  {
    title: "Разбор",
    items: [
      { href: "/history", label: "История", icon: History },
      { href: "/analysis-board", label: "Analysis Board", icon: Search },
      { href: "/board-editor", label: "Board Editor", icon: PencilRuler },
      { href: "/leaderboard", label: "Рейтинг", icon: Trophy },
      { href: "/learn", label: "Обучение", icon: GraduationCap },
      { href: "/pricing", label: "Pro", icon: Crown },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { mounted, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const shellSettings = getSettings();

  const nav = (
    <nav className="grid gap-5">
      {navSections.map((section) => (
        <div key={section.title}>
          <p className="px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8f8a80]">
            {section.title}
          </p>
          <div className="mt-2 grid gap-1">
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (pathname === item.href && typeof window !== "undefined") {
                    window.dispatchEvent(
                      new CustomEvent("knightly:navigate-home", { detail: item.href }),
                    );
                  }
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-[#d7d1c6] transition hover:bg-white/6 hover:text-white",
                  pathname === item.href &&
                    "bg-[#3d5a2c] text-white shadow-[inset_0_0_0_1px_rgba(157,196,110,0.25)]",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div
      className={cn(
        "min-h-screen text-[#f4efe4] lg:grid",
        shellSettings.zenMode ? "lg:grid-cols-[minmax(0,1fr)]" : "lg:grid-cols-[15rem_minmax(0,1fr)]",
        backgroundClass(shellSettings.backgroundTheme),
      )}
    >
      <aside className={cn("hidden border-r border-white/6 bg-[#1f1d1b] lg:flex lg:min-h-screen lg:flex-col lg:px-4 lg:py-5", shellSettings.zenMode && "lg:hidden")}>
        <Link href="/" className="flex items-center gap-3 rounded-2xl px-3 py-2">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#5e8a3c] text-white shadow-lg shadow-[#5e8a3c]/25">
            <Crown className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-lg font-black tracking-tight text-white">Knightly</span>
            <span className="block text-xs text-[#9c978d]">Play Chess</span>
          </span>
        </Link>

        <div className="mt-6 flex-1">{nav}</div>

        <div className="grid gap-2 border-t border-white/6 pt-4">
          <button
            type="button"
            className="flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-[#d7d1c6] transition hover:bg-white/6 hover:text-white"
          >
            <Search className="h-4 w-4" />
            <span>Поиск</span>
          </button>
          <button
            type="button"
            className="flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-[#d7d1c6] transition hover:bg-white/6 hover:text-white"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Сменить тему"
          >
            {mounted && resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            <span>Тема</span>
          </button>
          <Link
            href="/settings"
            className="flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-[#d7d1c6] transition hover:bg-white/6 hover:text-white"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>
          <Link
            href={user ? "/profile" : "/login"}
            className="flex h-12 items-center gap-3 rounded-2xl bg-[#5e8a3c] px-4 text-sm font-bold text-white transition hover:brightness-105"
          >
            <UserRound className="h-4 w-4" />
            <span className="truncate">{user ? user.username : "Войти"}</span>
          </Link>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-white/6 bg-[#24221f]/92 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#5e8a3c] text-white">
                <Gamepad2 className="h-5 w-5" />
              </span>
              <span className="text-base font-black text-white">Knightly</span>
            </Link>
            <Button
              className="h-10 w-10 border-white/10 bg-white/6 px-0 text-white hover:bg-white/12"
              variant="secondary"
              onClick={() => setOpen((value) => !value)}
              aria-label="Открыть навигацию"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
          {open ? (
            <div className="border-t border-white/6 bg-[#1f1d1b] px-4 py-4">
              {nav}
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  className="flex h-11 items-center gap-3 rounded-2xl bg-white/6 px-3 text-sm font-semibold text-[#e8e0d2]"
                  onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                >
                  {mounted && resolvedTheme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                  <span>Тема</span>
                </button>
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-white/6 px-5 text-sm font-semibold text-white"
                >
                  Settings
                </Link>
                <Link
                  href={user ? "/profile" : "/login"}
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#5e8a3c] px-5 text-sm font-semibold text-white"
                >
                  {user ? "Профиль" : "Войти"}
                </Link>
              </div>
            </div>
          ) : null}
        </header>

        <main className="min-h-screen px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
          {children}
        </main>
      </div>
    </div>
  );
}
