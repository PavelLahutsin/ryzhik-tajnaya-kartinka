import { describe, expect, it } from "vitest";
import { TRAIL, capturedPercent } from "./capture";
import { DEFAULT_LIVES, Game } from "./engine";

function makeGame(lives?: number, enemies = 1): Game {
  return new Game({ enemies, winPercent: 0.75, lives });
}

/** Sit a bee on a trail cell so the next tick performs one rewind. */
function sting(game: Game): void {
  const x = 4;
  const y = 4;
  game.grid[y]![x] = TRAIL;
  game.drawing = true;
  game.playerX = x;
  game.playerY = y;
  game.visualX = x;
  game.visualY = y;
  const bee = game.enemies[0]!;
  bee.x = x;
  bee.y = y;
  bee.vx = 0;
  bee.vy = 0;
  bee.acc = 10;
  game.update(0.05);
}

describe("lives", () => {
  it("starts a level with three hearts by default", () => {
    const game = makeGame();
    expect(DEFAULT_LIVES).toBe(3);
    expect(game.lives).toBe(DEFAULT_LIVES);
    expect(game.maxLives).toBe(DEFAULT_LIVES);
    expect(game.failed).toBe(false);
  });

  it("accepts a custom life count from the level config", () => {
    const game = makeGame(5);
    expect(game.lives).toBe(5);
    expect(game.maxLives).toBe(5);
  });

  it("takes one heart on a hit and softly rewinds", () => {
    const game = makeGame();
    const safeX = game.lastSafeX;
    const safeY = game.lastSafeY;
    sting(game);
    expect(game.lives).toBe(2);
    expect(game.failed).toBe(false);
    expect(game.drawing).toBe(false);
    expect(game.playerX).toBe(safeX);
    expect(game.playerY).toBe(safeY);
    expect(game.grid[4]![4]).not.toBe(TRAIL);
    expect(game.rewindPulse).toBeGreaterThan(0);
  });

  it("emits fail after the last heart, then ignores further hits", () => {
    const game = makeGame(2);
    const rewinds: number[] = [];
    const fails: number[] = [];
    game.on("rewind", () => rewinds.push(game.lives));
    game.on("fail", () => fails.push(game.lives));

    sting(game);
    expect(game.lives).toBe(1);
    expect(game.failed).toBe(false);
    expect(fails).toEqual([]);

    sting(game);
    expect(game.lives).toBe(0);
    expect(game.failed).toBe(true);
    expect(rewinds).toEqual([1, 0]);
    expect(fails).toEqual([0]);

    sting(game);
    expect(game.lives).toBe(0);
    expect(game.failed).toBe(true);
    expect(fails).toEqual([0]);
    expect(rewinds).toEqual([1, 0]);
  });

  it("does not move after the hearts are gone", () => {
    const game = makeGame(1);
    sting(game);
    expect(game.failed).toBe(true);
    const x = game.playerX;
    const y = game.playerY;
    game.setDirection(-1, 0);
    for (let i = 0; i < 20; i++) game.update(0.05);
    expect(game.playerX).toBe(x);
    expect(game.playerY).toBe(y);
    expect(game.dirX).toBe(0);
  });

  it("restores the field and the hearts on restart", () => {
    const game = makeGame(3, 2);
    sting(game);
    sting(game);
    sting(game);
    expect(game.failed).toBe(true);
    expect(game.lives).toBe(0);

    game.restart();
    expect(game.failed).toBe(false);
    expect(game.won).toBe(false);
    expect(game.drawing).toBe(false);
    expect(game.lives).toBe(3);
    expect(game.maxLives).toBe(3);
    expect(game.playerX).toBe(Math.floor(game.cols / 2));
    expect(game.playerY).toBe(game.rows - 1);
    expect(game.percent).toBeCloseTo(capturedPercent(game.grid), 10);
    expect(game.enemies.length).toBe(2);
    for (const row of game.grid) {
      expect(row.includes(TRAIL)).toBe(false);
    }
  });
});
