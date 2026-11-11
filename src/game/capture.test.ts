import { describe, expect, it } from "vitest";
import {
  CAPTURED,
  FOG,
  TRAIL,
  captureArea,
  capturedPercent,
  clearTrail,
  countCaptured,
  createGrid,
} from "./capture";
import type { Cell, Point } from "./capture";

function paint(grid: Cell[][], cells: Point[], value: Cell): void {
  for (const { x, y } of cells) grid[y]![x] = value;
}

function cellCounts(grid: Cell[][]): { fog: number; captured: number; trail: number } {
  let fog = 0;
  let captured = 0;
  let trail = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell === FOG) fog++;
      else if (cell === CAPTURED) captured++;
      else trail++;
    }
  }
  return { fog, captured, trail };
}

describe("createGrid", () => {
  it("marks only the border as captured", () => {
    const grid = createGrid(8, 5);
    expect(grid.length).toBe(5);
    expect(grid[0]!.length).toBe(8);
    expect(countCaptured(grid)).toBe(8 * 2 + 3 * 2);
    expect(grid[2]![3]).toBe(FOG);
    expect(grid[0]![0]).toBe(CAPTURED);
    expect(grid[4]![7]).toBe(CAPTURED);
  });
});

describe("captureArea", () => {
  it("captures the pocket an enemy cannot reach, and the trail itself", () => {
    // 8x5 field. A vertical cut at x=3 isolates the left interior (x=1,2).
    // Enemy stays on the right. Closing the cut must capture the left pocket.
    const grid = createGrid(8, 5);
    const trail: Point[] = [
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
    ];
    paint(grid, trail, TRAIL);

    const added = captureArea(grid, [{ x: 5, y: 2 }]);
    // Left pocket: 2 cols × 3 rows = 6, plus 3 trail cells.
    expect(added).toBe(9);
    expect(grid[2]![1]).toBe(CAPTURED);
    expect(grid[2]![2]).toBe(CAPTURED);
    expect(grid[1]![3]).toBe(CAPTURED);
    expect(grid[2]![5]).toBe(FOG);
    expect(grid[1]![6]).toBe(FOG);
  });

  it("captures only the trail when nothing is enclosed", () => {
    const grid = createGrid(8, 5);
    // A short stub that goes out and back, leaving no pocket.
    paint(grid, [{ x: 3, y: 1 }], TRAIL);
    const before = countCaptured(grid);
    const added = captureArea(grid, [{ x: 5, y: 2 }]);
    expect(added).toBe(1);
    expect(countCaptured(grid)).toBe(before + 1);
    expect(grid[1]![3]).toBe(CAPTURED);
    expect(grid[2]![3]).toBe(FOG);
    expect(grid[2]![4]).toBe(FOG);
  });

  it("captures nothing extra when each pocket has an enemy", () => {
    const grid = createGrid(8, 5);
    paint(grid, [{ x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }], TRAIL);
    const added = captureArea(grid, [
      { x: 1, y: 2 },
      { x: 5, y: 2 },
    ]);
    expect(added).toBe(3);
    expect(grid[2]![1]).toBe(FOG);
    expect(grid[2]![5]).toBe(FOG);
    expect(grid[2]![3]).toBe(CAPTURED);
  });

  it("ignores an enemy standing on captured or out-of-bounds cells", () => {
    const grid = createGrid(6, 5);
    paint(grid, [{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }], TRAIL);
    // Only a border (captured) enemy and one out of bounds: the whole
    // interior is unreachable, so everything leftover is captured.
    const added = captureArea(grid, [
      { x: 0, y: 0 },
      { x: -1, y: 2 },
    ]);
    expect(added).toBeGreaterThan(0);
    const counts = cellCounts(grid);
    expect(counts.fog).toBe(0);
    expect(counts.trail).toBe(0);
  });
});

describe("clearTrail and percent", () => {
  it("turns trail cells back into fog", () => {
    const grid = createGrid(6, 4);
    grid[1]![2] = TRAIL;
    grid[2]![2] = TRAIL;
    clearTrail(grid);
    expect(grid[1]![2]).toBe(FOG);
    expect(grid[2]![2]).toBe(FOG);
    expect(grid[0]![0]).toBe(CAPTURED);
  });

  it("reports the starting border share on a 20x12 field", () => {
    const grid = createGrid(20, 12);
    // Border is 20*2 + 10*2 = 60 of 240 cells = 25%.
    expect(capturedPercent(grid)).toBeCloseTo(0.25, 10);
  });
});
