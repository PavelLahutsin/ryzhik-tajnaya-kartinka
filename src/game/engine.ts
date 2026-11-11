import {
  CAPTURED,
  COLS,
  FOG,
  ROWS,
  TRAIL,
  captureArea,
  capturedPercent,
  clearTrail,
  createGrid,
  inBounds,
  revealAll,
  type Cell,
  type Point,
} from "./capture";
import { makeRng, pick, type Rng } from "./rng";

/** Hearts given at the start of a level, unless the level sets its own number. */
export const DEFAULT_LIVES = 3;

/** Helpers (улучшатели) that appear on the field. */
export type ItemKind = "heart" | "snail" | "honey" | "shield" | "star";
export const ITEM_KINDS: readonly ItemKind[] = ["heart", "snail", "honey", "shield", "star"];

/** How long each helper works, in seconds. */
export const EFFECT_TIME = {
  snail: 7,
  honey: 5,
  shield: 8,
} as const;

/** Seconds an uncollected helper stays on the field. */
export const ITEM_TTL = 14;
/** Default pause between helpers. */
export const ITEM_EVERY = 7;
/** Seconds after a ladybug bump when she cannot bump again. */
export const LADYBUG_COOLDOWN = 1.6;

export type GameConfig = {
  enemies: number;
  winPercent: number;
  /** Optional per-level life count. Falls back to DEFAULT_LIVES. */
  lives?: number;
  cols?: number;
  rows?: number;
  /** Seconds per cell for an ordinary bee. Smaller is faster. */
  beeStep?: number;
  /** How many of the bees are fast ones. */
  fastBees?: number;
  /** Ladybugs walk on the open (safe) part of the field. */
  ladybugs?: number;
  /** Puddles slow Ryzhik down while he walks through them. */
  puddles?: number;
  /** Which helpers may appear on this level. */
  items?: readonly ItemKind[];
  /** Pause between helpers in seconds. */
  itemEvery?: number;
  seed?: number;
};

export type GameEvent = "capture" | "rewind" | "win" | "fail" | "item" | "spawn";

export type EnemyKind = "bee" | "fast";

export type Enemy = {
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  acc: number;
};

export type Ladybug = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  acc: number;
};

export type Item = {
  kind: ItemKind;
  x: number;
  y: number;
  /** Seconds left before it fades away. */
  ttl: number;
};

export type Effects = {
  snail: number;
  honey: number;
  shield: number;
};

const LADYBUG_STEP = 0.42;
const PLAYER_STEP = 0.17;
const PUDDLE_FACTOR = 1.9;
const FAST_FACTOR = 0.62;
const SNAIL_FACTOR = 2.2;

export class Game {
  readonly cols: number;
  readonly rows: number;
  readonly grid: Cell[][];
  readonly winPercent: number;
  readonly maxLives: number;
  readonly enemies: Enemy[] = [];
  readonly ladybugs: Ladybug[] = [];
  readonly items: Item[] = [];
  /** Cell indexes (y * cols + x) that hold a puddle. */
  readonly puddles = new Set<number>();
  readonly effects: Effects = { snail: 0, honey: 0, shield: 0 };
  readonly itemKinds: readonly ItemKind[];

  lives: number;
  /** Bee or ladybug hits since the level (re)started; used for stars. */
  hits = 0;
  playerX = 0;
  playerY = 0;
  /** Smoothed position for drawing, in cell units. */
  visualX = 0;
  visualY = 0;
  dirX = 0;
  dirY = 0;
  lastSafeX = 0;
  lastSafeY = 0;
  dragTarget: Point | null = null;
  drawing = false;
  won = false;
  /** True after the last heart is gone, until restart(). */
  failed = false;
  /** While true the field stands still (intro card on screen). */
  paused = false;
  percent = 0;
  /** Share already open at the start (the border), so progress can start at zero. */
  startPercent = 0;
  /** Brief visual flash after a soft rewind. */
  rewindPulse = 0;
  /** Last helper picked up, for the "item" event. */
  lastItem: ItemKind | null = null;
  /** Seconds since the level (re)started. */
  time = 0;

  private playerAcc = 0;
  private readonly beeStep: number;
  private readonly enemyCount: number;
  private readonly fastCount: number;
  private readonly ladybugCount: number;
  private readonly puddleCount: number;
  private readonly itemEvery: number;
  private readonly seed: number;
  private rng: Rng;
  private itemTimer = 0;
  private ladybugCooldown = 0;
  private readonly listeners = new Map<GameEvent, Set<() => void>>();

  constructor(config: GameConfig) {
    this.cols = Math.max(6, Math.floor(config.cols ?? COLS));
    this.rows = Math.max(5, Math.floor(config.rows ?? ROWS));
    this.grid = createGrid(this.cols, this.rows);
    this.winPercent = config.winPercent;
    this.maxLives = Math.max(1, config.lives ?? DEFAULT_LIVES);
    this.lives = this.maxLives;
    this.enemyCount = Math.max(0, Math.min(4, config.enemies));
    this.fastCount = Math.max(0, Math.min(this.enemyCount, config.fastBees ?? 0));
    this.ladybugCount = Math.max(0, Math.min(2, config.ladybugs ?? 0));
    this.puddleCount = Math.max(0, Math.min(6, config.puddles ?? 0));
    this.itemKinds = (config.items ?? []).filter((kind) => ITEM_KINDS.includes(kind));
    this.itemEvery = Math.max(2, config.itemEvery ?? ITEM_EVERY);
    this.beeStep =
      config.beeStep ?? (this.enemyCount <= 1 ? 0.38 : this.enemyCount === 2 ? 0.34 : 0.3);
    this.seed = config.seed ?? 7;
    this.rng = makeRng(this.seed);
    this.reset();
  }

  on(event: GameEvent, handler: () => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
    return () => set.delete(handler);
  }

  setDirection(dx: number, dy: number): void {
    if (this.won || this.failed) return;
    // Four directions only; ignore diagonals and zeroes from a bad swipe.
    if (dx !== 0 && dy !== 0) {
      if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    this.dirX = Math.sign(dx);
    this.dirY = Math.sign(dy);
  }

  setDragTarget(x: number, y: number): void {
    if (this.won || this.failed) return;
    const tx = Math.max(0, Math.min(this.cols - 1, Math.floor(x)));
    const ty = Math.max(0, Math.min(this.rows - 1, Math.floor(y)));
    this.dragTarget = { x: tx, y: ty };
    this.aimAt(tx, ty);
  }

  /** Finger up or key up: stop if we are already on safe ground. */
  release(): void {
    this.dragTarget = null;
    if (!this.drawing) {
      this.dirX = 0;
      this.dirY = 0;
    }
  }

  /** Full level retry: clear the field, restore hearts, respawn bees. */
  restart(): void {
    const fresh = createGrid(this.cols, this.rows);
    for (let y = 0; y < this.rows; y++) {
      const row = this.grid[y]!;
      const src = fresh[y]!;
      for (let x = 0; x < this.cols; x++) row[x] = src[x]!;
    }
    this.rng = makeRng(this.seed);
    this.reset();
  }

  isPuddle(x: number, y: number): boolean {
    return this.puddles.has(y * this.cols + x);
  }

  itemAt(x: number, y: number): Item | undefined {
    return this.items.find((item) => item.x === x && item.y === y);
  }

  /** Put a helper on a cell. Used by spawning and by tests. */
  placeItem(kind: ItemKind, x: number, y: number, ttl = ITEM_TTL): Item | null {
    if (!inBounds(this.grid, x, y) || this.grid[y]![x] !== FOG) return null;
    if (this.itemAt(x, y)) return null;
    const item: Item = { kind, x, y, ttl };
    this.items.push(item);
    this.emit("spawn");
    return item;
  }

  update(dt: number): void {
    const step = Math.min(dt, 0.05);
    if (this.won || this.failed || this.paused) {
      this.visualX += (this.playerX - this.visualX) * Math.min(1, step * 12);
      this.visualY += (this.playerY - this.visualY) * Math.min(1, step * 12);
      return;
    }
    this.time += step;

    this.tickEffects(step);
    this.tickItems(step);

    this.playerAcc += step;
    let need = this.playerStepTime();
    while (this.playerAcc >= need) {
      this.playerAcc -= need;
      if (this.dragTarget) this.aimAt(this.dragTarget.x, this.dragTarget.y);
      this.stepPlayer();
      if (this.done()) break;
      need = this.playerStepTime();
    }

    if (!this.done() && this.effects.honey <= 0) {
      for (const enemy of this.enemies) {
        enemy.acc += step;
        const enemyStep = this.enemyStepTime(enemy);
        while (enemy.acc >= enemyStep) {
          enemy.acc -= enemyStep;
          this.stepEnemy(enemy);
          if (this.done()) break;
        }
        if (this.done()) break;
      }
      for (const bug of this.ladybugs) {
        if (this.done()) break;
        bug.acc += step;
        const bugStep = LADYBUG_STEP * (this.effects.snail > 0 ? SNAIL_FACTOR : 1);
        while (bug.acc >= bugStep) {
          bug.acc -= bugStep;
          this.stepLadybug(bug);
          if (this.done()) break;
        }
      }
    }
    if (!this.done()) this.checkLadybugs();

    this.visualX += (this.playerX - this.visualX) * Math.min(1, step * 14);
    this.visualY += (this.playerY - this.visualY) * Math.min(1, step * 14);
    if (this.rewindPulse > 0) this.rewindPulse = Math.max(0, this.rewindPulse - step * 3);
  }

  private done(): boolean {
    return this.won || this.failed;
  }

  private reset(): void {
    this.playerX = Math.floor(this.cols / 2);
    this.playerY = this.rows - 1;
    this.visualX = this.playerX;
    this.visualY = this.playerY;
    this.lastSafeX = this.playerX;
    this.lastSafeY = this.playerY;
    this.dirX = 0;
    this.dirY = 0;
    this.dragTarget = null;
    this.drawing = false;
    this.won = false;
    this.failed = false;
    this.lives = this.maxLives;
    this.hits = 0;
    this.time = 0;
    this.rewindPulse = 0;
    this.playerAcc = 0;
    this.itemTimer = Math.min(4, this.itemEvery);
    this.ladybugCooldown = 0;
    this.lastItem = null;
    this.effects.snail = 0;
    this.effects.honey = 0;
    this.effects.shield = 0;
    this.items.length = 0;
    this.placePuddles();
    this.spawnEnemies();
    this.spawnLadybugs();
    this.percent = capturedPercent(this.grid);
    this.startPercent = this.percent;
  }

  /** 0 at the start of the level, 1 when the picture opens. */
  progress(): number {
    if (this.won) return 1;
    const span = this.winPercent - this.startPercent;
    if (span <= 0) return 1;
    return Math.max(0, Math.min(1, (this.percent - this.startPercent) / span));
  }

  private emit(event: GameEvent): void {
    this.listeners.get(event)?.forEach((handler) => handler());
  }

  private playerStepTime(): number {
    const cell = this.grid[this.playerY]?.[this.playerX];
    const wet = cell !== CAPTURED && this.isPuddle(this.playerX, this.playerY);
    return PLAYER_STEP * (wet ? PUDDLE_FACTOR : 1);
  }

  private enemyStepTime(enemy: Enemy): number {
    const base = enemy.kind === "fast" ? this.beeStep * FAST_FACTOR : this.beeStep;
    return base * (this.effects.snail > 0 ? SNAIL_FACTOR : 1);
  }

  private tickEffects(step: number): void {
    this.effects.snail = Math.max(0, this.effects.snail - step);
    this.effects.honey = Math.max(0, this.effects.honey - step);
    this.effects.shield = Math.max(0, this.effects.shield - step);
    this.ladybugCooldown = Math.max(0, this.ladybugCooldown - step);
  }

  private tickItems(step: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i]!;
      item.ttl -= step;
      if (item.ttl <= 0) this.items.splice(i, 1);
    }
    if (this.itemKinds.length === 0 || this.items.length > 0) return;
    this.itemTimer -= step;
    if (this.itemTimer > 0) return;
    this.itemTimer = this.itemEvery;
    this.spawnItem();
  }

  /** Pick a helper that is useful right now and drop it on a quiet fog cell. */
  spawnItem(): Item | null {
    const kinds = this.itemKinds.filter((kind) => {
      if (kind === "heart") return this.lives < this.maxLives;
      if (kind === "snail") return this.effects.snail <= 0;
      if (kind === "honey") return this.effects.honey <= 0;
      if (kind === "shield") return this.effects.shield <= 0;
      return true;
    });
    const kind = pick(this.rng, kinds);
    if (!kind) return null;
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = 2 + Math.floor(this.rng() * (this.cols - 4));
      const y = 2 + Math.floor(this.rng() * (this.rows - 4));
      if (this.grid[y]![x] !== FOG || this.isPuddle(x, y)) continue;
      const nearBee = this.enemies.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) < 3);
      if (nearBee) continue;
      return this.placeItem(kind, x, y);
    }
    return null;
  }

  private collect(item: Item): void {
    const index = this.items.indexOf(item);
    if (index >= 0) this.items.splice(index, 1);
    switch (item.kind) {
      case "heart":
        this.lives = Math.min(this.maxLives, this.lives + 1);
        break;
      case "snail":
        this.effects.snail = EFFECT_TIME.snail;
        break;
      case "honey":
        this.effects.honey = EFFECT_TIME.honey;
        break;
      case "shield":
        this.effects.shield = EFFECT_TIME.shield;
        break;
      case "star":
        this.openAround(item.x, item.y);
        break;
    }
    this.lastItem = item.kind;
    this.emit("item");
    if (!this.won && this.percent >= this.winPercent) this.finish();
  }

  /** Star helper: open a 5×5 patch around the star (never under a bee). */
  private openAround(cx: number, cy: number): void {
    for (let y = cy - 2; y <= cy + 2; y++) {
      for (let x = cx - 2; x <= cx + 2; x++) {
        if (!inBounds(this.grid, x, y)) continue;
        if (this.grid[y]![x] !== FOG) continue;
        if (this.enemies.some((e) => Math.abs(e.x - x) <= 1 && Math.abs(e.y - y) <= 1)) continue;
        this.grid[y]![x] = CAPTURED;
      }
    }
    // Close pockets that are now cut off from every bee.
    if (!this.drawing) captureArea(this.grid, this.enemies);
    this.percent = capturedPercent(this.grid);
    this.collectCaptured();
    this.emit("capture");
  }

  /** Helpers inside a freshly opened area go to Ryzhik automatically. */
  private collectCaptured(): void {
    for (const item of [...this.items]) {
      if (this.grid[item.y]![item.x] === CAPTURED) this.collect(item);
    }
  }

  private aimAt(tx: number, ty: number): void {
    const dx = tx - this.playerX;
    const dy = ty - this.playerY;
    if (dx === 0 && dy === 0) {
      if (!this.drawing) {
        this.dirX = 0;
        this.dirY = 0;
      }
      return;
    }
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.dirX = Math.sign(dx);
      this.dirY = 0;
    } else {
      this.dirX = 0;
      this.dirY = Math.sign(dy);
    }
  }

  private placePuddles(): void {
    this.puddles.clear();
    const startX = Math.floor(this.cols / 2);
    for (let n = 0; n < this.puddleCount; n++) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const x = 2 + Math.floor(this.rng() * (this.cols - 5));
        const y = 2 + Math.floor(this.rng() * (this.rows - 5));
        // Keep the first steps from the start cell dry.
        if (Math.abs(x - startX) <= 1 && y >= this.rows - 4) continue;
        const cells = [
          [x, y],
          [x + 1, y],
          [x, y + 1],
          [x + 1, y + 1],
        ];
        if (cells.some(([px, py]) => this.isPuddle(px!, py!))) continue;
        for (const [px, py] of cells) this.puddles.add(py! * this.cols + px!);
        break;
      }
    }
  }

  private spawnEnemies(): void {
    this.enemies.length = 0;
    const spots: Point[] = [
      { x: Math.floor(this.cols / 2), y: Math.floor(this.rows / 2) },
      { x: Math.floor(this.cols * 0.3), y: Math.floor(this.rows * 0.4) },
      { x: Math.floor(this.cols * 0.7), y: Math.floor(this.rows * 0.55) },
      { x: Math.floor(this.cols * 0.4), y: Math.floor(this.rows * 0.3) },
    ];
    const dirs: Point[] = [
      { x: 1, y: 1 },
      { x: -1, y: 1 },
      { x: 1, y: -1 },
      { x: -1, y: -1 },
    ];
    for (let i = 0; i < this.enemyCount; i++) {
      const spot = spots[i]!;
      const dir = dirs[i]!;
      this.enemies.push({
        // The last bees on the list are the fast ones.
        kind: i >= this.enemyCount - this.fastCount ? "fast" : "bee",
        x: spot.x,
        y: spot.y,
        vx: dir.x,
        vy: dir.y,
        acc: i * 0.05,
      });
    }
  }

  private spawnLadybugs(): void {
    this.ladybugs.length = 0;
    const starts: Ladybug[] = [
      { x: 0, y: 0, vx: 1, vy: 0, acc: 0 },
      { x: this.cols - 1, y: 0, vx: -1, vy: 0, acc: 0.2 },
    ];
    for (let i = 0; i < this.ladybugCount; i++) this.ladybugs.push({ ...starts[i]! });
  }

  private onEnemy(x: number, y: number): boolean {
    return this.enemies.some((enemy) => enemy.x === x && enemy.y === y);
  }

  private stepPlayer(): void {
    if (this.dirX === 0 && this.dirY === 0) return;
    const nx = this.playerX + this.dirX;
    const ny = this.playerY + this.dirY;
    if (!inBounds(this.grid, nx, ny)) {
      if (!this.drawing) {
        this.dirX = 0;
        this.dirY = 0;
      }
      return;
    }
    const cell = this.grid[ny]![nx]!;
    if (cell === TRAIL) {
      // Bumping into his own trail: with the shield he simply waits.
      if (this.effects.shield > 0) return;
      this.hit();
      return;
    }
    if (this.onEnemy(nx, ny) && cell !== CAPTURED) {
      if (this.effects.shield > 0) return;
      this.hit();
      return;
    }

    if (cell === FOG) {
      this.grid[ny]![nx] = TRAIL;
      this.drawing = true;
    }

    this.playerX = nx;
    this.playerY = ny;

    const item = this.itemAt(nx, ny);
    if (item) this.collect(item);
    if (this.done()) return;

    if (this.grid[ny]![nx] === CAPTURED) {
      this.lastSafeX = nx;
      this.lastSafeY = ny;
      if (this.drawing) {
        this.drawing = false;
        captureArea(this.grid, this.enemies);
        this.percent = capturedPercent(this.grid);
        this.emit("capture");
        this.collectCaptured();
        if (!this.won && this.percent >= this.winPercent) this.finish();
      }
    }
  }

  private blocked(x: number, y: number): boolean {
    return !inBounds(this.grid, x, y) || this.grid[y]![x] === CAPTURED;
  }

  private isTrail(x: number, y: number): boolean {
    return inBounds(this.grid, x, y) && this.grid[y]![x] === TRAIL;
  }

  private hitsPlayer(x: number, y: number): boolean {
    return this.drawing && this.playerX === x && this.playerY === y;
  }

  /** A bee touched the trail. With the shield on, she just bounces away. */
  private sting(enemy: Enemy): void {
    if (this.effects.shield > 0) {
      enemy.vx *= -1;
      enemy.vy *= -1;
      return;
    }
    this.hit();
  }

  private stepEnemy(enemy: Enemy): void {
    let nx = enemy.x + enemy.vx;
    let ny = enemy.y + enemy.vy;

    if (this.isTrail(nx, ny) || this.hitsPlayer(nx, ny)) {
      this.sting(enemy);
      return;
    }

    if (this.blocked(nx, ny)) {
      const hitX = this.blocked(enemy.x + enemy.vx, enemy.y);
      const hitY = this.blocked(enemy.x, enemy.y + enemy.vy);
      if (hitX) enemy.vx *= -1;
      if (hitY) enemy.vy *= -1;
      if (!hitX && !hitY) {
        enemy.vx *= -1;
        enemy.vy *= -1;
      }
      nx = enemy.x + enemy.vx;
      ny = enemy.y + enemy.vy;
      if (this.isTrail(nx, ny) || this.hitsPlayer(nx, ny)) {
        this.sting(enemy);
        return;
      }
      if (this.blocked(nx, ny)) return;
    }

    enemy.x = nx;
    enemy.y = ny;
    if (this.hitsPlayer(enemy.x, enemy.y) || this.isTrail(enemy.x, enemy.y)) {
      this.sting(enemy);
    }
  }

  /** Is this open cell next to fog? Ladybugs like to walk along that edge. */
  private onEdge(x: number, y: number): boolean {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const c = this.grid[y + dy]?.[x + dx];
        if (c === FOG || c === TRAIL) return true;
      }
    }
    return false;
  }

  /** Ladybugs walk only on open (CAPTURED) cells, following the fog edge. */
  stepLadybug(bug: Ladybug): void {
    const dirs: Point[] = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    const open = dirs.filter((d) => {
      const x = bug.x + d.x;
      const y = bug.y + d.y;
      return inBounds(this.grid, x, y) && this.grid[y]![x] === CAPTURED;
    });
    const forward = open.filter((d) => !(d.x === -bug.vx && d.y === -bug.vy));
    const edge = forward.filter((d) => this.onEdge(bug.x + d.x, bug.y + d.y));
    const straight = edge.find((d) => d.x === bug.vx && d.y === bug.vy);
    const choice =
      straight ?? pick(this.rng, edge) ?? pick(this.rng, forward) ?? pick(this.rng, open);
    if (!choice) return;
    bug.vx = choice.x;
    bug.vy = choice.y;
    bug.x += choice.x;
    bug.y += choice.y;
  }

  private checkLadybugs(): void {
    if (this.ladybugCooldown > 0 || this.effects.shield > 0) return;
    for (const bug of this.ladybugs) {
      if (bug.x === this.playerX && bug.y === this.playerY) {
        bug.vx *= -1;
        bug.vy *= -1;
        this.ladybugCooldown = LADYBUG_COOLDOWN;
        this.hit();
        return;
      }
    }
  }

  /** Soft rewind: trail clears, Ryzhik goes back to safe ground, one heart goes out. */
  private hit(): void {
    if (this.won || this.failed) return;
    clearTrail(this.grid);
    this.playerX = this.lastSafeX;
    this.playerY = this.lastSafeY;
    this.visualX = this.playerX;
    this.visualY = this.playerY;
    this.dirX = 0;
    this.dirY = 0;
    this.drawing = false;
    this.rewindPulse = 1;
    this.hits += 1;
    this.lives = Math.max(0, this.lives - 1);
    this.emit("rewind");
    if (this.lives <= 0) {
      this.failed = true;
      this.dragTarget = null;
      this.emit("fail");
    }
  }

  private finish(): void {
    this.won = true;
    revealAll(this.grid);
    this.items.length = 0;
    this.percent = 1;
    this.dirX = 0;
    this.dirY = 0;
    this.dragTarget = null;
    this.drawing = false;
    this.emit("win");
  }
}
