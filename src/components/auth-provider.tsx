"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { UserProfile } from "@/lib/types";
import {
  getProfiles,
  getSessionUserId,
  saveProfiles,
  setSessionUserId,
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
    city: string;
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
    city: string;
    password: string;
  }) {
    if (!input.email || !input.username || !input.password) {
      throw new Error("Email, username, and password are required.");
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            username: input.username,
            city: input.city || "Unknown",
          },
        },
      });
      if (error) throw error;
      if (!data.user) return;
      const profile = await upsertProfileToSupabase({
        id: data.user.id,
        email: input.email,
        username: input.username,
        city: input.city || "Unknown",
        avatar: initials(input.username),
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
      (profile) => profile.email.toLowerCase() === input.email.toLowerCase(),
    );
    if (existing) {
      setSessionUserId(existing.id);
      setUserId(existing.id);
      return;
    }

    const profile: UserProfile = {
      id: crypto.randomUUID(),
      email: input.email,
      username: input.username,
      city: input.city || "Unknown",
      avatar: initials(input.username) || "K",
      rating: 1200,
      gamesCount: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      createdAt: new Date().toISOString(),
    };
    const next = [profile, ...profiles];
    setProfiles(next);
    saveProfiles(next);
    setSessionUserId(profile.id);
    setUserId(profile.id);
  }

  async function login(email: string, password?: string) {
    const supabase = getSupabaseClient();
    if (supabase) {
      if (!password) throw new Error("Password is required.");
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error("No Supabase user returned.");
      const profile = await fetchProfileFromSupabase(data.user.id);
      if (profile) {
        setProfiles((current) => [profile, ...current.filter((item) => item.id !== profile.id)]);
        setUserId(profile.id);
        setSessionUserId(profile.id);
      }
      return;
    }

    const existing = profiles.find(
      (profile) => profile.email.toLowerCase() === email.toLowerCase(),
    );

    if (!existing) throw new Error("No local account found. Register first.");
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
