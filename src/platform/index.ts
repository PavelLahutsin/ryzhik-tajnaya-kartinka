import { capacitorAdapter, isCapacitorNative } from "./capacitor";
import type { PlatformAdapter } from "./types";
import { isVkLaunch, vkAdapter } from "./vk";
import { webAdapter } from "./web";

export type { PlatformAdapter, PlatformStorage } from "./types";

/**
 * Native shell, then a VK launch, otherwise the ordinary browser.
 * VK and Capacitor adapters are stubs and fall back to web storage.
 */
export function detectPlatform(): PlatformAdapter {
  if (isCapacitorNative()) return capacitorAdapter;
  if (isVkLaunch()) return vkAdapter;
  return webAdapter;
}

export const platform: PlatformAdapter = detectPlatform();
