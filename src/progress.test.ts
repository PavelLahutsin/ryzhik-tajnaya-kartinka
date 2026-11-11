import { describe, expect, it } from "vitest";
import { normalizeProgress, recordWin } from "./progress";

describe("progress", () => {
  it("reads old saves that only had completed levels", () => {
    const p = normalizeProgress({ completed: ["a", 3, "b"] });
    expect(p.completed).toEqual(["a", "b"]);
    expect(p.stars).toEqual({ a: 1, b: 1 });
  });

  it("survives junk", () => {
    expect(normalizeProgress(null)).toEqual({ completed: [], stars: {} });
    expect(normalizeProgress("x")).toEqual({ completed: [], stars: {} });
    expect(normalizeProgress({ completed: "a", stars: { a: "3" } })).toEqual({ completed: [], stars: {} });
  });

  it("keeps the best stars and never lowers them", () => {
    let p = normalizeProgress(null);
    p = recordWin(p, "a", 2);
    expect(p.stars.a).toBe(2);
    p = recordWin(p, "a", 1);
    expect(p.stars.a).toBe(2);
    p = recordWin(p, "a", 3);
    expect(p.stars.a).toBe(3);
    p = recordWin(p, "a", 7);
    expect(p.stars.a).toBe(3);
    expect(p.completed).toEqual(["a"]);
  });
});
