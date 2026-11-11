import type { PlatformAdapter } from "./types";
import { webStorage } from "./web";

/**
 * Stub for a future VK Mini App shell.
 * Detection is ready, but storage and launch still use the web adapter
 * until the VK Bridge is wired up.
 */
export function isVkLaunch(): boolean {
  if (typeof window === "undefined") return false;
  const search = window.location.search;
  const hash = window.location.hash;
  return /(?:^|[?#&])vk_[^=&]+=/.test(`${search}${hash}`);
}

export const vkAdapter: PlatformAdapter = {
  id: "vk",
  storage: webStorage,
};
