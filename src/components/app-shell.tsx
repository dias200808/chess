"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, Menu, Moon, Sun, X } from "lucide-react";
import { useState } from "react";
import { navItems } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { mounted, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1 lg:flex-row lg:items-center">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setOpen(false)}
          className={cn(
            "rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
            pathname === item.href && "bg-muted text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/82 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Crown className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-base font-black tracking-tight">Knightly</span>
              <span className="block text-xs text-muted-foreground">Chess MVP</span>
            </span>
          </Link>

          <div className="hidden lg:block">{nav}</div>

          <div className="hidden items-center gap-2 lg:flex">
            <Button
              type="button"
              variant="ghost"
              className="h-10 w-10 px-0"
              aria-label="Toggle theme"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {mounted && resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Link
              href={user ? "/profile" : "/login"}
              className="rounded-full border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              {user ? user.username : "Login"}
            </Link>
          </div>

          <Button
            className="h-10 w-10 px-0 lg:hidden"
            variant="secondary"
            onClick={() => setOpen((value) => !value)}
            aria-label="Open navigation"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
        {open ? (
          <div className="border-t bg-background px-4 py-4 lg:hidden">
            {nav}
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              >
                Theme
              </Button>
              <Link
                href={user ? "/profile" : "/login"}
                onClick={() => setOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                {user ? "Profile" : "Login"}
              </Link>
            </div>
          </div>
        ) : null}
      </header>
      <main className="mx-auto min-h-[calc(100vh-4.5rem)] max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        {children}
      </main>
    </div>
  );
}
