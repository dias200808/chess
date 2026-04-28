"use client";

import type { UserProfile } from "@/lib/types";
import { ensureGuestSession, updateGuestSession } from "@/lib/storage";

export function getOnlinePlayerKey(userId?: string | null) {
  if (userId) return `user:${userId}`;
  if (typeof window === "undefined") return "guest:server";
  return `guest:${ensureGuestSession().id}`;
}

export function getOnlinePlayerName(user?: UserProfile | null) {
  if (user?.username) return user.username;
  if (typeof window === "undefined") return "Guest";
  return ensureGuestSession().username;
}

export function setGuestOnlinePlayerName(username: string) {
  if (typeof window === "undefined") return null;
  return updateGuestSession({ username: username.trim() || ensureGuestSession().username });
}

export function roomSideKey(roomId: string) {
  return `knightly-room:${roomId}:side`;
}
