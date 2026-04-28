"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { STARTING_RATING } from "@/lib/rating";
import {
  clearGuestTransferableGames,
  getGuestSession,
  getLocalCredentialByEmail,
  getProfiles,
  getPuzzleState,
  getSessionUserId,
  logStudentActivity,
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
  upsertPuzzleProgressToSupabase,
} from "@/lib/supabase-data";
import type { AccountRole, UserProfile } from "@/lib/types";

type AuthContextValue = {
  user: UserProfile | null;
  profiles: UserProfile[];
  register: (input: {
    email: string;
    username: string;
    fullName?: string;
    password: string;
    city?: string;
    country?: string;
    schoolName?: string;
    age?: number | null;
    role?: AccountRole;
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

function normalizeUsername(value: string) {
  return value.trim().replace(/\s+/g, "_");
}

function withRatingDefaults(profile: UserProfile): UserProfile {
  return {
    ...profile,
    role: profile.role ?? "student",
    teacherVerification: profile.teacherVerification ?? "unverified",
    rating: profile.rating ?? STARTING_RATING,
    bulletRating: profile.bulletRating ?? profile.rating ?? STARTING_RATING,
    blitzRating: profile.blitzRating ?? profile.rating ?? STARTING_RATING,
    rapidRating: profile.rapidRating ?? profile.rating ?? STARTING_RATING,
    classicalRating: profile.classicalRating ?? profile.rating ?? STARTING_RATING,
    puzzleRating: profile.puzzleRating ?? STARTING_RATING,
  };
}

function authErrorMessage(error: unknown, action: "register" | "login") {
  const fallback =
    action === "register"
      ? "Could not create the account right now. Please try again."
      : "Could not sign in right now. Please try again.";

  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "";

  const normalized = message.trim().toLowerCase();
  if (!normalized) return fallback;

  if (
    normalized.includes("user already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("already been registered")
  ) {
    return action === "register"
      ? "An account with this email already exists. Try logging in instead."
      : "An account with this email already exists. Try logging in.";
  }
  if (normalized.includes("invalid login credentials")) {
    return "Wrong email or password.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirm your email first, then try signing in again.";
  }
  if (
    normalized.includes("too many requests") ||
    normalized.includes("rate limit") ||
    normalized.includes("security purposes")
  ) {
    return "Too many attempts. Please wait 10 seconds and try again.";
  }
  if (normalized.includes("invalid email")) {
    return "Enter a valid email address.";
  }
  if (normalized.includes("network") || normalized.includes("fetch")) {
    return "Network error. Check your internet and try again.";
  }

  return message;
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
  const [profiles, setProfiles] = useState<UserProfile[]>(() => getProfiles().map(withRatingDefaults));
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

  async function claimGuestProgress(nextUserId: string, username: string) {
    const guestSession = getGuestSession();
    if (!guestSession) return;

    const claimedGameIds: string[] = [];
    try {
      const response = await fetch("/api/guest/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestKey: `guest:${guestSession.id}`,
          userId: nextUserId,
          username,
          gameIds: guestSession.transferableGameIds,
        }),
      });
      if (response.ok) {
        const payload = (await response.json()) as { claimedGameIds?: string[] };
        claimedGameIds.push(...(payload.claimedGameIds ?? []));
      }
    } catch {
      // The account still works even if guest game claiming is temporarily unavailable.
    }

    const puzzleState = getPuzzleState();
    await Promise.all(
      Object.entries(puzzleState).map(([puzzleId, progress]) =>
        upsertPuzzleProgressToSupabase(nextUserId, puzzleId, progress).catch(() => null),
      ),
    );

    if (claimedGameIds.length) clearGuestTransferableGames(claimedGameIds);
  }

  async function register(input: {
    email: string;
    username: string;
    fullName?: string;
    password: string;
    city?: string;
    country?: string;
    schoolName?: string;
    age?: number | null;
    role?: AccountRole;
  }) {
    const email = input.email.trim().toLowerCase();
    const username = normalizeUsername(input.username);
    const fullName = input.fullName?.trim();
    const password = input.password.trim();
    const role = input.role ?? "student";
    const city = input.city?.trim() || "";
    const country = input.country?.trim() || "";
    const schoolName = input.schoolName?.trim() || "";
    const age = typeof input.age === "number" && Number.isFinite(input.age) ? input.age : null;

    if (!email || !username || !password) {
      throw new Error("Fill in email, username, and password.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address.");
    }
    if (username.length < 2) {
      throw new Error("Username must be at least 2 characters long.");
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      throw new Error("Use only letters, numbers, and underscores in username.");
    }
    if (password.length < 8) {
      throw new Error("Password must contain at least 8 characters.");
    }
    if (!fullName) {
      throw new Error("Enter your full name.");
    }
    if (!city || !country) {
      throw new Error("Enter your city and country.");
    }
    if (role === "teacher" && !schoolName) {
      throw new Error("Enter your school or academy name.");
    }

    const existingEmail = profiles.find((profile) => profile.email.toLowerCase() === email);
    const usernameTaken = profiles.some(
      (profile) =>
        profile.id !== existingEmail?.id &&
        profile.username.trim().toLowerCase() === username.toLowerCase(),
    );
    if (usernameTaken) {
      throw new Error("This username is already taken. Choose another one.");
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            full_name: fullName,
            role,
            school_name: schoolName,
            city,
            country,
            age,
          },
        },
      });
      if (error) throw new Error(authErrorMessage(error, "register"));
      if (!data.user) {
        throw new Error("Could not create the account right now. Please try again.");
      }

      const fallbackProfile: UserProfile = {
        id: data.user.id,
        email,
        username,
        fullName,
        role,
        schoolName,
        age,
        teacherVerification: role === "teacher" ? "pending" : "unverified",
        city,
        country,
        avatar: initials(username) || "K",
        rating: STARTING_RATING,
        bulletRating: STARTING_RATING,
        blitzRating: STARTING_RATING,
        rapidRating: STARTING_RATING,
        classicalRating: STARTING_RATING,
        puzzleRating: STARTING_RATING,
        gamesCount: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        createdAt: new Date().toISOString(),
      };

      let profile: UserProfile | null = null;
      try {
        profile = await upsertProfileToSupabase(fallbackProfile);
      } catch {
        profile = await fetchProfileFromSupabase(data.user.id).catch(() => null);
      }

      const nextProfile = profile ?? fallbackProfile;
      setProfiles((current) => [nextProfile, ...current.filter((item) => item.id !== nextProfile.id)]);
      setUserId(nextProfile.id);
      setSessionUserId(nextProfile.id);
      await claimGuestProgress(nextProfile.id, nextProfile.username);
      if (data.session) {
        logStudentActivity({
          userId: nextProfile.id,
          type: "login",
          title: "Signed in",
          details: "Account created and classroom access enabled.",
        });
      }
      return;
    }

    const passwordHash = await hashPassword(password);
    const credential = getLocalCredentialByEmail(email);
    if (existingEmail && credential) {
      throw new Error("An account with this email already exists. Try logging in instead.");
    }

    const profile: UserProfile = existingEmail
      ? {
          ...existingEmail,
          username,
          fullName: fullName ?? existingEmail.fullName,
          role,
          schoolName: schoolName || existingEmail.schoolName,
          age: age ?? existingEmail.age ?? null,
          teacherVerification:
            role === "teacher"
              ? existingEmail.teacherVerification ?? "pending"
              : existingEmail.teacherVerification ?? "unverified",
          city: city || existingEmail.city || "",
          country: country || existingEmail.country || "",
          avatar: initials(username) || existingEmail.avatar || "K",
          bulletRating: existingEmail.bulletRating ?? existingEmail.rating ?? STARTING_RATING,
          blitzRating: existingEmail.blitzRating ?? existingEmail.rating ?? STARTING_RATING,
          rapidRating: existingEmail.rapidRating ?? existingEmail.rating ?? STARTING_RATING,
          classicalRating: existingEmail.classicalRating ?? existingEmail.rating ?? STARTING_RATING,
          puzzleRating: existingEmail.puzzleRating ?? STARTING_RATING,
        }
      : {
          id: crypto.randomUUID(),
          email,
          username,
          fullName,
          role,
          schoolName,
          age,
          teacherVerification: role === "teacher" ? "pending" : "unverified",
          city,
          country,
          avatar: initials(username) || "K",
          rating: STARTING_RATING,
          bulletRating: STARTING_RATING,
          blitzRating: STARTING_RATING,
          rapidRating: STARTING_RATING,
          classicalRating: STARTING_RATING,
          puzzleRating: STARTING_RATING,
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
    logStudentActivity({
      userId: profile.id,
      type: "login",
      title: "Signed in",
      details: "Account created and classroom access enabled.",
    });
  }

  async function login(email: string, password?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password?.trim() ?? "";
    const supabase = getSupabaseClient();

    if (supabase) {
      if (!normalizedPassword) throw new Error("Enter your password.");
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: normalizedPassword,
      });
      if (error) throw new Error(authErrorMessage(error, "login"));
      if (!data.user) throw new Error("Could not load the user account from Supabase.");

      const profile = await fetchProfileFromSupabase(data.user.id);
      if (profile) {
        setProfiles((current) => [profile, ...current.filter((item) => item.id !== profile.id)]);
        setUserId(profile.id);
        setSessionUserId(profile.id);
        await claimGuestProgress(profile.id, profile.username);
        logStudentActivity({
          userId: profile.id,
          type: "login",
          title: "Logged in",
        });
      }
      return;
    }

    const existing = profiles.find((profile) => profile.email.toLowerCase() === normalizedEmail);
    if (!existing) {
      throw new Error("No account was found with this email. Create an account first.");
    }
    if (!normalizedPassword) {
      throw new Error("Enter your password.");
    }

    const credential = getLocalCredentialByEmail(normalizedEmail);
    if (!credential) {
      throw new Error(
        "This local account was created before passwords were enabled. Register again to enable password login.",
      );
    }

    const passwordHash = await hashPassword(normalizedPassword);
    if (credential.passwordHash !== passwordHash) {
      throw new Error("Wrong email or password.");
    }

    setSessionUserId(existing.id);
    setUserId(existing.id);
    logStudentActivity({
      userId: existing.id,
      type: "login",
      title: "Logged in",
    });
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
      avatar: patch.avatar ?? (patch.username ? initials(patch.username) : user.avatar),
    };

    const supabase = getSupabaseClient();
    if (supabase) {
      await upsertProfileToSupabase(updatedProfile);
    }

    const next = profiles.map((profile) =>
      profile.id === user.id ? updatedProfile : profile,
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
