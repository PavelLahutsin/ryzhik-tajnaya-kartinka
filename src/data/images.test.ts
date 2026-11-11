import { describe, expect, it } from "vitest";
import { levels } from "./levels";

describe("level pictures", () => {
  it("every level has its picture in src/assets/levels", () => {
    for (const level of levels) expect(level.image, level.file).not.toBe("");
  });
});
