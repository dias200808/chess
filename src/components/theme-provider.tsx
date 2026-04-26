"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  mounted: boolean;
  setTheme: (theme: Theme) => void;
} | null>(null);

const listeners = new Set<() => void>();

function emitThemeChange() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function subscribeMounted() {
  return () => {};
}

function getMountedSnapshot() {
  return true;
}

function getMountedServerSnapshot() {
  return false;
}

function getThemeSnapshot(): Theme {
  if (typeof window === "undefined") return "dark";
  return (window.localStorage.getItem("knightly.theme") as Theme | null) ?? "dark";
}

function getServerThemeSnapshot(): Theme {
  return "dark";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  return resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, getServerThemeSnapshot);
  const mounted = useSyncExternalStore(
    subscribeMounted,
    getMountedSnapshot,
    getMountedServerSnapshot,
  );
  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;

  useEffect(() => {
    applyTheme(theme);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((window.localStorage.getItem("knightly.theme") as Theme | null) === "system") {
        applyTheme("system");
        emitThemeChange();
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  function setTheme(nextTheme: Theme) {
    window.localStorage.setItem("knightly.theme", nextTheme);
    applyTheme(nextTheme);
    emitThemeChange();
  }

  const value = useMemo(
    () => ({ theme, resolvedTheme, mounted, setTheme }),
    [mounted, resolvedTheme, theme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
