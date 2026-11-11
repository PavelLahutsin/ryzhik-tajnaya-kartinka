import type { PlatformAdapter } from "./types";
import { webStorage } from "./web";

/**
 * Stub for a future Capacitor Android/iOS shell.
 * Until native plugins are added, storage stays on localStorage.
 */
type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === "function") return cap.isNativePlatform() === true;
  const name = cap.getPlatform?.();
  return name === "android" || name === "ios";
}

export const capacitorAdapter: PlatformAdapter = {
  id: "capacitor",
  storage: webStorage,
};
