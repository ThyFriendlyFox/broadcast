import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeJson<T = any>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const u = new URL(url);
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

export function domainFromUrl(input: string): string {
  try {
    const u = new URL(normalizeUrl(input));
    return u.hostname.replace(/^www\./, "");
  } catch {
    return input.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

/** Deterministic pseudo-random in [0,1) from a string seed. */
export function seededRandom(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function () {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
