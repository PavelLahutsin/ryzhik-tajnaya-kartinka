import { ITEM_KINDS, type GameConfig, type ItemKind } from "../game/engine";
import levelsJson from "./levels.json";

/** Every level picture in src/assets/levels, bundled by Vite. */
const images = import.meta.glob<string>("../assets/levels/*.webp", {
  eager: true,
  import: "default",
});

function imageFor(file: string): string {
  return images[`../assets/levels/${file}`] ?? "";
}

/** New thing a level teaches, shown on a small card before the level starts. */
export type IntroKey = "howto" | "heart" | "snail" | "star" | "puddle" | "honey" | "fast" | "ladybug" | "shield";

export const INTROS: Record<IntroKey, { title: string; text: string }> = {
  howto: {
    title: "Как играть",
    text: "Веди Рыжика пальцем. Обведи кусочек поля — и он откроется!",
  },
  heart: { title: "Сердечко", text: "Возьми сердечко — оно вернёт жизнь." },
  snail: { title: "Улитка", text: "Возьми улитку — пчёлки станут медленными." },
  star: { title: "Звёздочка", text: "Звёздочка сразу открывает кусочек картинки." },
  puddle: { title: "Лужи", text: "По луже Рыжик идёт медленно." },
  honey: { title: "Мёд", text: "Пчёлки едят мёд и не летают." },
  fast: { title: "Быстрая пчёлка", text: "Оранжевая пчёлка летает быстрее. Осторожно!" },
  ladybug: {
    title: "Божья коровка",
    text: "Коровка гуляет по открытой земле. Обходи её!",
  },
  shield: { title: "Пузырь", text: "В пузыре Рыжику не страшны пчёлки." },
};

export type LevelDef = {
  id: string;
  title: string;
  file: string;
  enemies: number;
  winPercent: number;
  lives?: number;
  beeStep?: number;
  fastBees?: number;
  ladybugs?: number;
  puddles?: number;
  items?: ItemKind[];
  intro?: IntroKey;
};

export type WorldDef = {
  id: string;
  title: string;
  color: string;
  cols: number;
  rows: number;
  levels: LevelDef[];
};

export type Level = LevelDef & {
  image: string;
  worldId: string;
  /** 1-based number across the whole game. */
  number: number;
  cols: number;
  rows: number;
};

export type World = Omit<WorldDef, "levels"> & { levels: Level[] };

const data = levelsJson as { worlds: WorldDef[] };

let counter = 0;
export const worlds: World[] = data.worlds.map((world) => ({
  ...world,
  levels: world.levels.map((level) => ({
    ...level,
    image: imageFor(level.file),
    worldId: world.id,
    number: ++counter,
    cols: world.cols,
    rows: world.rows,
  })),
}));

export const levels: Level[] = worlds.flatMap((world) => world.levels);

export function getLevel(id: string): Level | undefined {
  return levels.find((level) => level.id === id);
}

export function getWorld(id: string): World | undefined {
  return worlds.find((world) => world.id === id);
}

/** Levels open one after another: the first is always open, then each needs the one before. */
export function isUnlocked(id: string, completed: readonly string[], list: readonly Level[] = levels): boolean {
  const index = list.findIndex((level) => level.id === id);
  if (index < 0) return false;
  if (index === 0) return true;
  const previous = list[index - 1];
  return previous ? completed.includes(previous.id) : false;
}

export function nextLevel(id: string, list: readonly Level[] = levels): Level | undefined {
  const index = list.findIndex((level) => level.id === id);
  return index >= 0 ? list[index + 1] : undefined;
}

/** First level the child has not finished yet (the one the play button should open). */
export function currentLevel(completed: readonly string[], list: readonly Level[] = levels): Level | undefined {
  return list.find((level) => !completed.includes(level.id)) ?? list[list.length - 1];
}

export function gameConfig(level: Level): GameConfig {
  return {
    enemies: level.enemies,
    winPercent: level.winPercent,
    lives: level.lives,
    cols: level.cols,
    rows: level.rows,
    beeStep: level.beeStep,
    fastBees: level.fastBees,
    ladybugs: level.ladybugs,
    puddles: level.puddles,
    items: level.items,
    seed: level.number * 7919,
  };
}

/** Sanity checks for levels.json; returns a list of problems (empty when fine). */
export function validateLevels(list: readonly Level[] = levels): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const level of list) {
    if (seen.has(level.id)) problems.push(`${level.id}: повтор id`);
    seen.add(level.id);
    if (!level.title.trim()) problems.push(`${level.id}: нет названия`);
    if (!(level.winPercent >= 0.5 && level.winPercent <= 0.85)) problems.push(`${level.id}: winPercent`);
    if (!(level.enemies >= 1 && level.enemies <= 4)) problems.push(`${level.id}: enemies`);
    if ((level.fastBees ?? 0) > level.enemies) problems.push(`${level.id}: fastBees > enemies`);
    for (const item of level.items ?? []) {
      if (!ITEM_KINDS.includes(item)) problems.push(`${level.id}: неизвестный предмет ${item}`);
    }
    if (level.intro && !(level.intro in INTROS)) problems.push(`${level.id}: неизвестный intro`);
    if (level.cols < 10 || level.rows < 6) problems.push(`${level.id}: маленькое поле`);
  }
  return problems;
}
