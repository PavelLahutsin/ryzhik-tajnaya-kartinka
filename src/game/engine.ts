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

export type GameConfig = {
  enemies: number;
  winPercent: number;
};

export type GameEvent = "capture" | "rewind" | "win";

export type Enemy = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  acc: number;
};

export class Game {
  readonly cols = COLS;
  readonly rows = ROWS;
  readonly grid: Cell[][];
  readonly winPercent: number;
  readonly enemies: Enemy[] = [];

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
  percent = 0;
  /** Brief visual flash after a soft rewind. */
  rewindPulse = 0;

  private playerAcc = 0;
  private readonly playerStep = 0.17;
  private readonly enemyStep: number;
  private readonly listeners = new Map<GameEvent, Set<() => void>>();

  constructor(config: GameConfig) {
    this.grid = createGrid(this.cols, this.rows);
    this.winPercent = config.winPercent;
    this.playerX = Math.floor(this.cols / 2);
    this.playerY = this.rows - 1;
    this.visualX = this.playerX;
    this.visualY = this.playerY;
    this.lastSafeX = this.playerX;
    this.lastSafeY = this.playerY;
    this.percent = capturedPercent(this.grid);
    this.enemyStep = config.enemies <= 1 ? 0.38 : config.enemies === 2 ? 0.34 : 0.3;
    this.spawnEnemies(Math.max(1, Math.min(3, config.enemies)));
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
    if (this.won) return;
    // Four directions only; ignore diagonals and zeroes from a bad swipe.
    if (dx !== 0 && dy !== 0) {
      if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    this.dirX = Math.sign(dx);
    this.dirY = Math.sign(dy);
  }

  setDragTarget(x: number, y: number): void {
    if (this.won) return;
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

  update(dt: number): void {
    if (this.won) {
      this.visualX += (this.playerX - this.visualX) * Math.min(1, dt * 12);
      this.visualY += (this.playerY - this.visualY) * Math.min(1, dt * 12);
      return;
    }

    const step = Math.min(dt, 0.05);
    this.playerAcc += step;
    while (this.playerAcc >= this.playerStep) {
      this.playerAcc -= this.playerStep;
      if (this.dragTarget) this.aimAt(this.dragTarget.x, this.dragTarget.y);
      this.stepPlayer();
      if (this.won) break;
    }

    if (!this.won) {
      for (const enemy of this.enemies) {
        enemy.acc += step;
        while (enemy.acc >= this.enemyStep) {
          enemy.acc -= this.enemyStep;
          this.stepEnemy(enemy);
          if (this.won) break;
        }
        if (this.won) break;
      }
    }

    this.visualX += (this.playerX - this.visualX) * Math.min(1, step * 14);
    this.visualY += (this.playerY - this.visualY) * Math.min(1, step * 14);
    if (this.rewindPulse > 0) this.rewindPulse = Math.max(0, this.rewindPulse - step * 3);
  }

  private emit(event: GameEvent): void {
    this.listeners.get(event)?.forEach((handler) => handler());
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

  private spawnEnemies(count: number): void {
    const spots: Point[] = [
      { x: Math.floor(this.cols / 2), y: Math.floor(this.rows / 2) },
      { x: Math.floor(this.cols * 0.3), y: Math.floor(this.rows * 0.4) },
      { x: Math.floor(this.cols * 0.7), y: Math.floor(this.rows * 0.55) },
    ];
    const dirs: Point[] = [
      { x: 1, y: 1 },
      { x: -1, y: 1 },
      { x: 1, y: -1 },
    ];
    for (let i = 0; i < count; i++) {
      const spot = spots[i]!;
      const dir = dirs[i]!;
      this.enemies.push({
        x: spot.x,
        y: spot.y,
        vx: dir.x,
        vy: dir.y,
        acc: i * 0.05,
      });
    }
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
      this.rewind();
      return;
    }
    if (this.onEnemy(nx, ny) && cell !== CAPTURED) {
      this.rewind();
      return;
    }

    if (cell === FOG) {
      this.grid[ny]![nx] = TRAIL;
      this.drawing = true;
    }

    this.playerX = nx;
    this.playerY = ny;

    if (this.grid[ny]![nx] === CAPTURED) {
      this.lastSafeX = nx;
      this.lastSafeY = ny;
      if (this.drawing) {
        this.drawing = false;
        captureArea(this.grid, this.enemies);
        this.percent = capturedPercent(this.grid);
        this.emit("capture");
        if (this.percent >= this.winPercent) this.finish();
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

  private stepEnemy(enemy: Enemy): void {
    let nx = enemy.x + enemy.vx;
    let ny = enemy.y + enemy.vy;

    if (this.isTrail(nx, ny) || this.hitsPlayer(nx, ny)) {
      this.rewind();
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
        this.rewind();
        return;
      }
      if (this.blocked(nx, ny)) return;
    }

    enemy.x = nx;
    enemy.y = ny;
    if (this.hitsPlayer(enemy.x, enemy.y) || this.isTrail(enemy.x, enemy.y)) {
      this.rewind();
    }
  }

  private rewind(): void {
    if (this.won) return;
    clearTrail(this.grid);
    this.playerX = this.lastSafeX;
    this.playerY = this.lastSafeY;
    this.visualX = this.playerX;
    this.visualY = this.playerY;
    this.dirX = 0;
    this.dirY = 0;
    this.drawing = false;
    this.rewindPulse = 1;
    this.emit("rewind");
  }

  private finish(): void {
    this.won = true;
    revealAll(this.grid);
    this.percent = 1;
    this.dirX = 0;
    this.dirY = 0;
    this.dragTarget = null;
    this.drawing = false;
    this.emit("win");
  }
}
