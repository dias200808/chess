"use client";

export function getOnlinePlayerKey(userId?: string | null) {
  if (userId) return `user:${userId}`;
  const key = "knightly-guest-player-key";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = `guest:${crypto.randomUUID()}`;
  localStorage.setItem(key, next);
  return next;
}

export function roomSideKey(roomId: string) {
  return `knightly-room:${roomId}:side`;
}
