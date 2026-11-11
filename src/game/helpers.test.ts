import { describe, expect, it } from "vitest";
import { CAPTURED, FOG, TRAIL } from "./capture";
import { EFFECT_TIME, Game, ITEM_TTL, LADYBUG_COOLDOWN, type GameConfig } from "./engine";
import { starsFor, totalStars } from "./stars";

function makeGame(extra: Partial<GameConfig> = {}): Game {
  return new Game({ enemies: 1, winPercent: 0.75, cols: 16, rows: 9, ...extra });
}

/** Walk Ryzhik one cell to the right onto (x, y) from (x - 1, y). */
function stepInto(game: Game, x: number, y: number): void {
  game.playerX = x - 1;
  game.playerY = y;
  game.lastSafeX = x - 1;
  game.lastSafeY = y;
  game.grid[y]![x - 1] = CAPTURED;
  game.setDirection(1, 0);
  game.update(0.05);
  game.update(0.05);
  game.update(0.05);
  game.update(0.05);
}

function parkBees(game: Game): void {
  for (const bee of game.enemies) {
    bee.x = game.cols - 3;
    bee.y = game.rows - 3;
    bee.vx = 0;
    bee.vy = 0;
  }
}

describe("level config", () => {
  it("uses the grid size from the level", () => {
    const game = makeGame({ cols: 18, rows: 10 });
    expect(game.cols).toBe(18);
    expect(game.rows).toBe(10);
    expect(game.grid.length).toBe(10);
    expect(game.grid[0]!.length).toBe(18);
    expect(game.playerX).toBe(9);
    expect(game.playerY).toBe(9);
  });

  it("makes the last bees fast ones", () => {
    const game = makeGame({ enemies: 3, fastBees: 1 });
    expect(game.enemies.map((e) => e.kind)).toEqual(["bee", "bee", "fast"]);
  });

  it("places puddles inside the field, away from the border", () => {
    const game = makeGame({ puddles: 3, seed: 3 });
    expect(game.puddles.size).toBe(12);
    for (const index of game.puddles) {
      const x = index % game.cols;
      const y = Math.floor(index / game.cols);
      expect(game.grid[y]![x]).toBe(FOG);
    }
  });

  it("is repeatable for the same seed", () => {
    const a = makeGame({ puddles: 2, seed: 42 });
    const b = makeGame({ puddles: 2, seed: 42 });
    expect([...a.puddles]).toEqual([...b.puddles]);
  });
});

describe("puddles", () => {
  it("slow Ryzhik down while he walks through one", () => {
    const dry = makeGame({ seed: 5 });
    const wet = makeGame({ puddles: 1, seed: 5 });
    parkBees(dry);
    parkBees(wet);
    const index = [...wet.puddles][0]!;
    const x = index % wet.cols;
    const y = Math.floor(index / wet.cols);
    for (const g of [dry, wet]) {
      g.playerX = x;
      g.playerY = 0;
      g.lastSafeX = x;
      g.lastSafeY = 0;
      g.grid[y]![x] = TRAIL;
      g.playerY = y;
      g.drawing = true;
      g.setDirection(0, 1);
    }
    let dryTime = 0;
    while (dry.playerY === y && dryTime < 3) {
      dry.update(0.01);
      dryTime += 0.01;
    }
    let wetTime = 0;
    while (wet.playerY === y && wetTime < 3) {
      wet.update(0.01);
      wetTime += 0.01;
    }
    expect(wetTime).toBeGreaterThan(dryTime * 1.5);
  });
});

describe("helpers", () => {
  it("spawns only helpers allowed for the level", () => {
    const game = makeGame({ items: ["snail"], seed: 9 });
    const item = game.spawnItem();
    expect(item?.kind).toBe("snail");
    expect(game.grid[item!.y]![item!.x]).toBe(FOG);
  });

  it("does not offer a heart while all hearts are full", () => {
    const game = makeGame({ items: ["heart"] });
    expect(game.spawnItem()).toBeNull();
    game.lives = 2;
    expect(game.spawnItem()?.kind).toBe("heart");
  });

  it("appears on its own after a pause and fades away later", () => {
    const game = makeGame({ items: ["star"], itemEvery: 3 });
    parkBees(game);
    for (let t = 0; t < 3.2; t += 0.05) game.update(0.05);
    expect(game.items.length).toBe(1);
    for (let t = 0; t < ITEM_TTL + 0.2; t += 0.05) {
      game.items[0] && (game.items[0].ttl = Math.min(game.items[0].ttl, ITEM_TTL));
      game.update(0.05);
      if (game.items.length === 0) break;
    }
    expect(game.items.length).toBe(0);
  });

  it("heart gives back one heart, up to the maximum", () => {
    const game = makeGame();
    parkBees(game);
    game.lives = 1;
    game.placeItem("heart", 3, 4);
    stepInto(game, 3, 4);
    expect(game.lives).toBe(2);
    expect(game.items.length).toBe(0);
    expect(game.lastItem).toBe("heart");
  });

  it("snail makes bees slower for a while", () => {
    const game = makeGame({ beeStep: 0.3 });
    const bee = game.enemies[0]!;
    bee.x = 8;
    bee.y = 4;
    bee.vx = 1;
    bee.vy = 0;
    bee.acc = 0;
    game.placeItem("snail", 3, 2);
    stepInto(game, 3, 2);
    expect(game.effects.snail).toBeGreaterThan(EFFECT_TIME.snail - 1);
    const startX = bee.x;
    for (let i = 0; i < 12; i++) game.update(0.05); // 0.6 s
    // Normal speed would be 2 cells in 0.6 s; slowed it is at most 1.
    expect(Math.abs(bee.x - startX)).toBeLessThanOrEqual(1);
  });

  it("honey stops the bees until it runs out", () => {
    const game = makeGame({ beeStep: 0.2 });
    const bee = game.enemies[0]!;
    bee.x = 8;
    bee.y = 4;
    bee.vx = 1;
    bee.vy = 1;
    game.placeItem("honey", 3, 2);
    stepInto(game, 3, 2);
    const at = { x: bee.x, y: bee.y };
    for (let i = 0; i < 40; i++) game.update(0.05); // 2 s
    expect({ x: bee.x, y: bee.y }).toEqual(at);
    for (let i = 0; i < 100; i++) game.update(0.05); // past the 5 s
    expect(game.effects.honey).toBe(0);
    expect({ x: bee.x, y: bee.y }).not.toEqual(at);
  });

  it("shield: a bee on the trail bounces off and no heart is lost", () => {
    const game = makeGame();
    game.effects.shield = EFFECT_TIME.shield;
    game.grid[4]![4] = TRAIL;
    game.drawing = true;
    game.playerX = 4;
    game.playerY = 5;
    const bee = game.enemies[0]!;
    bee.x = 3;
    bee.y = 3;
    bee.vx = 1;
    bee.vy = 1;
    bee.acc = 1;
    game.update(0.05);
    expect(game.lives).toBe(3);
    expect(game.hits).toBe(0);
    expect(game.grid[4]![4]).toBe(TRAIL);
    expect(bee.vx).toBe(-1);
  });

  it("star opens a patch around itself", () => {
    const game = makeGame();
    parkBees(game);
    const before = game.percent;
    game.placeItem("star", 5, 4);
    stepInto(game, 5, 4);
    expect(game.lastItem).toBe("star");
    expect(game.percent).toBeGreaterThan(before);
    expect(game.grid[4]![6]).not.toBe(FOG);
    expect(game.grid[2]![7]).toBe(CAPTURED);
  });

  it("helpers inside a captured area are collected automatically", () => {
    const game = makeGame();
    parkBees(game);
    game.lives = 2;
    game.placeItem("heart", 2, 1);
    // Cut off the top-left corner: walk down from (3,0) to (3,2), then left to the border.
    game.playerX = 3;
    game.playerY = 0;
    game.lastSafeX = 3;
    game.lastSafeY = 0;
    game.setDirection(0, 1);
    for (let i = 0; i < 8; i++) game.update(0.05);
    game.setDirection(-1, 0);
    for (let i = 0; i < 16; i++) game.update(0.05);
    expect(game.grid[1]![2]).toBe(CAPTURED);
    expect(game.items.length).toBe(0);
    expect(game.lives).toBe(3);
  });
});

describe("ladybug", () => {
  it("walks only on open ground", () => {
    const game = makeGame({ ladybugs: 1 });
    parkBees(game);
    const bug = game.ladybugs[0]!;
    for (let i = 0; i < 60; i++) {
      game.stepLadybug(bug);
      expect(game.grid[bug.y]![bug.x]).toBe(CAPTURED);
    }
  });

  it("costs one heart on a bump, then waits before the next one", () => {
    const game = makeGame({ ladybugs: 1 });
    parkBees(game);
    const bug = game.ladybugs[0]!;
    bug.x = game.playerX;
    bug.y = game.playerY;
    bug.acc = 0;
    game.update(0.01);
    expect(game.lives).toBe(2);
    expect(game.hits).toBe(1);
    bug.x = game.playerX;
    bug.y = game.playerY;
    game.update(0.01);
    expect(game.lives).toBe(2);
    for (let t = 0; t < LADYBUG_COOLDOWN + 0.1; t += 0.05) {
      bug.acc = 0;
      bug.x = 0;
      bug.y = 0;
      game.update(0.05);
    }
    bug.x = game.playerX;
    bug.y = game.playerY;
    bug.acc = 0;
    game.update(0.01);
    expect(game.lives).toBe(1);
  });

  it("is harmless inside the shield", () => {
    const game = makeGame({ ladybugs: 1 });
    parkBees(game);
    game.effects.shield = 5;
    const bug = game.ladybugs[0]!;
    bug.x = game.playerX;
    bug.y = game.playerY;
    game.update(0.01);
    expect(game.lives).toBe(3);
  });
});

describe("progress to the goal", () => {
  it("starts at zero and reaches one at the goal", () => {
    const game = makeGame();
    expect(game.progress()).toBe(0);
    game.percent = (game.startPercent + game.winPercent) / 2;
    expect(game.progress()).toBeCloseTo(0.5, 5);
    game.percent = 1;
    expect(game.progress()).toBe(1);
  });
});

describe("pause", () => {
  it("nothing moves while the intro card is open", () => {
    const game = makeGame({ items: ["star"], itemEvery: 2 });
    game.paused = true;
    const bee = { ...game.enemies[0]! };
    for (let i = 0; i < 100; i++) game.update(0.05);
    expect(game.enemies[0]!.x).toBe(bee.x);
    expect(game.items.length).toBe(0);
    expect(game.time).toBe(0);
  });
});

describe("stars", () => {
  it("gives 3 stars with no hits, 2 with one, otherwise 1", () => {
    expect(starsFor(0)).toBe(3);
    expect(starsFor(1)).toBe(2);
    expect(starsFor(2)).toBe(1);
    expect(starsFor(9)).toBe(1);
  });

  it("counts hits since the level started and resets them on restart", () => {
    const game = makeGame();
    game.grid[4]![4] = TRAIL;
    game.drawing = true;
    game.playerX = 4;
    game.playerY = 4;
    const bee = game.enemies[0]!;
    bee.x = 4;
    bee.y = 4;
    bee.vx = 0;
    bee.vy = 0;
    bee.acc = 1;
    game.update(0.05);
    expect(game.hits).toBe(1);
    game.restart();
    expect(game.hits).toBe(0);
  });

  it("sums stars over a list of levels", () => {
    expect(totalStars({ a: 3, b: 1, c: 9 }, ["a", "b", "c", "d"])).toBe(7);
  });
});
