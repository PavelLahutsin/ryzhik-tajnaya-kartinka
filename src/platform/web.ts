import type { PlatformAdapter, PlatformStorage } from "./types";

const PREFIX = "ryzhik-kartinka:";

export const webStorage: PlatformStorage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  async set<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* Quota exceeded: progress is nice to have, never worth a crash. */
    }
  },
  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  },
};

export const webAdapter: PlatformAdapter = {
  id: "web",
  storage: webStorage,
};
