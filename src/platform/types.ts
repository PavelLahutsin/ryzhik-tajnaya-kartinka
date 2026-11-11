/**
 * Thin platform boundary. The app talks only to this adapter.
 * Web is implemented now; VK Mini App and Capacitor are stubs for later.
 */
export interface PlatformStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface PlatformAdapter {
  readonly id: "web" | "vk" | "capacitor";
  readonly storage: PlatformStorage;
}
