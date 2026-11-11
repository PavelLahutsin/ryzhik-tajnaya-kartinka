import { describe, expect, it } from "vitest";
import { currentLevel, gameConfig, isUnlocked, levels, nextLevel, validateLevels, worlds } from "./levels";
import levelsJson from "./levels.json";

describe("levels.json", () => {
  it("has no problems", () => {
    expect(validateLevels()).toEqual([]);
  });

  it("has three worlds of five levels", () => {
    expect(worlds.map((w) => w.id)).toEqual(["ryzhik", "semya", "druzya"]);
    for (const world of worlds) expect(world.levels.length).toBe(5);
    expect(levels.length).toBe(15);
    expect(levels.map((l) => l.number)).toEqual(levels.map((_, i) => i + 1));
  });

  it("keeps the ids of the first release so old progress still counts", () => {
    const ids = levels.map((l) => l.id);
    for (const id of ["ryzhik-stoit", "ryzhik-mashet", "ryzhik-zaryadka"]) expect(ids).toContain(id);
  });

  it("introduces each new mechanic once, with an intro card, one at a time", () => {
    const seen = new Set<string>();
    for (const level of levels) {
      const things = new Set<string>(level.items ?? []);
      if (level.puddles) things.add("puddle");
      if (level.fastBees) things.add("fast");
      if (level.ladybugs) things.add("ladybug");
      const fresh = [...things].filter((t) => !seen.has(t));
      expect(fresh.length, level.id).toBeLessThanOrEqual(1);
      if (fresh.length === 1) expect(level.intro, level.id).toBe(fresh[0]);
      fresh.forEach((t) => seen.add(t));
    }
    expect(levels[0]!.intro).toBe("howto");
  });

  it("never gets easier from one level to the next", () => {
    for (let i = 1; i < levels.length; i++) {
      const a = levels[i - 1]!;
      const b = levels[i]!;
      expect(b.winPercent, b.id).toBeGreaterThanOrEqual(a.winPercent);
      expect(b.cols * b.rows, b.id).toBeGreaterThanOrEqual(a.cols * a.rows);
    }
  });

  it("uses a different picture file for every level", () => {
    const raw = levelsJson as { worlds: { levels: { file: string }[] }[] };
    const files = raw.worlds.flatMap((w) => w.levels.map((l) => l.file));
    expect(new Set(files).size).toBe(files.length);
  });

  it("builds an engine config from the level and its world", () => {
    const level = levels[5]!;
    const config = gameConfig(level);
    expect(config.cols).toBe(worlds[1]!.cols);
    expect(config.rows).toBe(worlds[1]!.rows);
    expect(config.puddles).toBe(level.puddles);
    expect(config.items).toEqual(level.items);
  });
});

describe("unlocking", () => {
  it("opens the first level, then each after the previous one", () => {
    expect(isUnlocked(levels[0]!.id, [])).toBe(true);
    expect(isUnlocked(levels[1]!.id, [])).toBe(false);
    expect(isUnlocked(levels[1]!.id, [levels[0]!.id])).toBe(true);
    expect(isUnlocked("nope", [])).toBe(false);
  });

  it("opens the next world after the last level of the previous one", () => {
    const lastOfFirst = worlds[0]!.levels[4]!;
    const firstOfSecond = worlds[1]!.levels[0]!;
    expect(isUnlocked(firstOfSecond.id, [])).toBe(false);
    expect(isUnlocked(firstOfSecond.id, [lastOfFirst.id])).toBe(true);
    expect(nextLevel(lastOfFirst.id)?.id).toBe(firstOfSecond.id);
    expect(nextLevel(levels[levels.length - 1]!.id)).toBeUndefined();
  });

  it("points the child at the first unfinished level", () => {
    expect(currentLevel([])?.id).toBe(levels[0]!.id);
    expect(currentLevel([levels[0]!.id, levels[1]!.id])?.id).toBe(levels[2]!.id);
    expect(currentLevel(levels.map((l) => l.id))?.id).toBe(levels[levels.length - 1]!.id);
  });
});
