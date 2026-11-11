/** Grid helpers and the area-capture algorithm. Pure logic, no DOM. */

export const FOG = 0;
export const CAPTURED = 1;
export const TRAIL = 2;

export type Cell = 0 | 1 | 2;
export type Point = { x: number; y: number };

/** Kid-friendly grid: large cells on a phone, short levels. */
export const COLS = 20;
export const ROWS = 12;

const DIRS: readonly Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function createGrid(cols = COLS, rows = ROWS): Cell[][] {
  const grid: Cell[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < cols; x++) {
      const border = y === 0 || x === 0 || y === rows - 1 || x === cols - 1;
      row.push(border ? CAPTURED : FOG);
    }
    grid.push(row);
  }
  return grid;
}

export function inBounds(grid: Cell[][], x: number, y: number): boolean {
  return y >= 0 && y < grid.length && x >= 0 && x < (grid[0]?.length ?? 0);
}

export function countCaptured(grid: Cell[][]): number {
  let n = 0;
  for (const row of grid) {
    for (const cell of row) if (cell === CAPTURED) n++;
  }
  return n;
}

export function totalCells(grid: Cell[][]): number {
  return grid.length * (grid[0]?.length ?? 0);
}

export function capturedPercent(grid: Cell[][]): number {
  const total = totalCells(grid);
  return total === 0 ? 0 : countCaptured(grid) / total;
}

export function clearTrail(grid: Cell[][]): void {
  for (const row of grid) {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === TRAIL) row[x] = FOG;
    }
  }
}

/**
 * Capture by exclusion: flood-fill FOG cells reachable by any enemy
 * (4-connected, cannot cross a TRAIL or CAPTURED cell). Every FOG cell
 * the enemies cannot reach, plus the finished trail, becomes CAPTURED.
 * Returns how many cells were newly captured.
 */
export function captureArea(grid: Cell[][], enemies: readonly Point[]): number {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return 0;

  const seen: boolean[] = new Array(rows * cols).fill(false);
  const qx: number[] = [];
  const qy: number[] = [];
  const index = (x: number, y: number): number => y * cols + x;

  for (const enemy of enemies) {
    const x = Math.floor(enemy.x);
    const y = Math.floor(enemy.y);
    if (!inBounds(grid, x, y)) continue;
    if (grid[y]![x] !== FOG) continue;
    const i = index(x, y);
    if (seen[i]) continue;
    seen[i] = true;
    qx.push(x);
    qy.push(y);
  }

  let head = 0;
  while (head < qx.length) {
    const x = qx[head]!;
    const y = qy[head]!;
    head++;
    for (const dir of DIRS) {
      const nx = x + dir.x;
      const ny = y + dir.y;
      if (!inBounds(grid, nx, ny)) continue;
      if (grid[ny]![nx] !== FOG) continue;
      const i = index(nx, ny);
      if (seen[i]) continue;
      seen[i] = true;
      qx.push(nx);
      qy.push(ny);
    }
  }

  let added = 0;
  for (let y = 0; y < rows; y++) {
    const row = grid[y]!;
    for (let x = 0; x < cols; x++) {
      const cell = row[x];
      if (cell === TRAIL || (cell === FOG && !seen[index(x, y)])) {
        row[x] = CAPTURED;
        added++;
      }
    }
  }
  return added;
}

export function revealAll(grid: Cell[][]): void {
  for (const row of grid) {
    for (let x = 0; x < row.length; x++) row[x] = CAPTURED;
  }
}
