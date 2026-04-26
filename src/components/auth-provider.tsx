"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { UserProfile } from "@/lib/types";
import {
  getLocalCredentialByEmail,
  getProfiles,
  getSessionUserId,
  saveProfiles,
  setSessionUserId,
  upsertLocalCredential,
} from "@/lib/storage";
import { getSupabaseClient } from "@/lib/supabase";
import {
  fetchProfileFromSupabase,
  fetchProfilesFromSupabase,
  isSupabaseConfigured,
  upsertProfileToSupabase,
} from "@/lib/supabase-data";

type AuthContextValue = {
  user: UserProfile | null;
  profiles: UserProfile[];
  register: (input: {
    email: string;
    username: string;
    password: string;
  }) => Promise<void>;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  authMode: "supabase" | "local";
};

const AuthContext = createContext<AuthContextValue | null>(null);

function initials(name: string) {
  return name
    .split(/\s|_/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

async function hashPassword(password: string) {
  const normalized = password.trim();
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<UserProfile[]>(() => getProfiles());
  const [userId, setUserId] = useState<string | null>(() => getSessionUserId());
  const authMode = isSupabaseConfigured() ? "supabase" : "local";

  const user = useMemo(
    () => profiles.find((profile) => profile.id === userId) ?? null,
    [profiles, userId],
  );

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const activeSupabase = supabase;

    async function hydrateSupabaseSession() {
      try {
        const [{ data: sessionData }, remoteProfiles] = await Promise.all([
          activeSupabase.auth.getSession(),
          fetchProfilesFromSupabase(),
        ]);
        if (remoteProfiles) setProfiles(remoteProfiles);
        const sessionUser = sessionData.session?.user;
        if (!sessionUser) return;
        const profile = await fetchProfileFromSupabase(sessionUser.id);
        if (profile) {
          setUserId(profile.id);
          setSessionUserId(profile.id);
        }
      } catch {
        // Keep local fallback state if Supabase tables are not migrated yet.
      }
    }

    void hydrateSupabaseSession();
    const { data } = activeSupabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user;
      setUserId(sessionUser?.id ?? null);
      setSessionUserId(sessionUser?.id ?? null);
      if (sessionUser?.id) {
        void fetchProfilesFromSupabase().then((remoteProfiles) => {
          if (remoteProfiles) setProfiles(remoteProfiles);
        });
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  async function register(input: {
    email: string;
    username: string;
    password: string;
  }) {
    const email = input.email.trim().toLowerCase();
    const username = input.username.trim();
    const password = input.password.trim();

    if (!email || !username || !password) {
      throw new Error("Заполните email, имя пользователя и пароль.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Введите корректный email.");
    }

    if (username.length < 2) {
      throw new Error("Имя пользователя должно быть не короче 2 символов.");
    }

    if (password.length < 8) {
      throw new Error("Пароль должен содержать минимум 8 символов.");
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      });
      if (error) throw error;
      if (!data.user) return;
      const profile = await upsertProfileToSupabase({
        id: data.user.id,
        email,
        username,
        city: "",
        avatar: initials(username),
        rating: 1200,
        gamesCount: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      });
      if (profile) {
        setProfiles((current) => [profile, ...current.filter((item) => item.id !== profile.id)]);
        setUserId(profile.id);
        setSessionUserId(profile.id);
      }
      return;
    }

    const existing = profiles.find(
      (profile) => profile.email.toLowerCase() === email,
    );
    const passwordHash = await hashPassword(password);
    const credential = getLocalCredentialByEmail(email);

    if (existing && credential) {
      throw new Error("Аккаунт с таким email уже существует. Войдите в систему.");
    }

    const profile: UserProfile = existing
      ? {
          ...existing,
          username,
          city: existing.city ?? "",
          avatar: initials(username) || existing.avatar || "K",
        }
      : {
          id: crypto.randomUUID(),
          email,
          username,
          city: "",
          avatar: initials(username) || "K",
          rating: 1200,
          gamesCount: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          createdAt: new Date().toISOString(),
        };

    const next = [profile, ...profiles.filter((item) => item.id !== profile.id)];
    setProfiles(next);
    saveProfiles(next);
    upsertLocalCredential({ email, passwordHash });
    setSessionUserId(profile.id);
    setUserId(profile.id);
  }

  async function login(email: string, password?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password?.trim() ?? "";
    const supabase = getSupabaseClient();
    if (supabase) {
      if (!normalizedPassword) throw new Error("Введите пароль.");
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: normalizedPassword,
      });
      if (error) throw error;
      if (!data.user) throw new Error("Не удалось получить пользователя из Supabase.");
      const profile = await fetchProfileFromSupabase(data.user.id);
      if (profile) {
        setProfiles((current) => [profile, ...current.filter((item) => item.id !== profile.id)]);
        setUserId(profile.id);
        setSessionUserId(profile.id);
      }
      return;
    }

    const existing = profiles.find(
      (profile) => profile.email.toLowerCase() === normalizedEmail,
    );

    if (!existing) throw new Error("Локальный аккаунт не найден. Сначала зарегистрируйтесь.");
    if (!normalizedPassword) throw new Error("Введите пароль.");

    const credential = getLocalCredentialByEmail(normalizedEmail);
    if (!credential) {
      throw new Error("Этот локальный аккаунт создан по старой схеме. Зарегистрируйтесь заново, чтобы включить пароль.");
    }

    const passwordHash = await hashPassword(normalizedPassword);
    if (credential.passwordHash !== passwordHash) {
      throw new Error("Неверный пароль.");
    }

    setSessionUserId(existing.id);
    setUserId(existing.id);
  }

  async function logout() {
    const supabase = getSupabaseClient();
    if (supabase) await supabase.auth.signOut();
    setSessionUserId(null);
    setUserId(null);
  }

  async function updateProfile(patch: Partial<UserProfile>) {
    if (!user) return;
    const updatedProfile = {
      ...user,
      ...patch,
      avatar: patch.username ? initials(patch.username) : user.avatar,
    };
    const supabase = getSupabaseClient();
    if (supabase) {
      await upsertProfileToSupabase(updatedProfile);
    }
    const next = profiles.map((profile) =>
      profile.id === user.id
        ? updatedProfile
        : profile,
    );
    setProfiles(next);
    saveProfiles(next);
  }

  return (
    <AuthContext.Provider
      value={{ user, profiles, register, login, logout, updateProfile, authMode }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
