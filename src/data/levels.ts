import mashet from "../assets/levels/ryzhik-mashet.webp";
import stoit from "../assets/levels/ryzhik-stoit.webp";
import zaryadka from "../assets/levels/ryzhik-zaryadka.webp";
import levelsJson from "./levels.json";

const images: Record<string, string> = {
  "ryzhik-stoit": stoit,
  "ryzhik-mashet": mashet,
  "ryzhik-zaryadka": zaryadka,
};

export type LevelDef = {
  id: string;
  title: string;
  file: string;
  enemies: number;
  winPercent: number;
  /** Optional. When omitted, the engine uses DEFAULT_LIVES (3). */
  lives?: number;
};

export type Level = LevelDef & { image: string };

export const levels: Level[] = (levelsJson as LevelDef[]).map((level) => ({
  ...level,
  image: images[level.id] ?? "",
}));

export function getLevel(id: string): Level | undefined {
  return levels.find((level) => level.id === id);
}

export function isUnlocked(id: string, completed: readonly string[]): boolean {
  const index = levels.findIndex((level) => level.id === id);
  if (index <= 0) return true;
  const previous = levels[index - 1];
  return previous ? completed.includes(previous.id) : false;
}

export function nextLevel(id: string): Level | undefined {
  const index = levels.findIndex((level) => level.id === id);
  return index >= 0 ? levels[index + 1] : undefined;
}
