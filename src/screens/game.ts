import { getLevel } from "../data/levels";
import { Game } from "../game/engine";
import { drawGame, loadMarker, pointerToCell, sizeCanvas } from "../game/render";
import { navigate } from "../router";
import { markCompleted } from "../storage";
import { el } from "../ui/dom";
import { toolbar } from "./levels";

const KEYS: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  A: { x: -1, y: 0 },
  D: { x: 1, y: 0 },
  W: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
};

export function renderGame(root: HTMLElement, levelId: string): () => void {
  const level = getLevel(levelId);
  if (!level) {
    navigate("/levels", { replace: true });
    return () => undefined;
  }

  const game = new Game({ enemies: level.enemies, winPercent: level.winPercent });
  const percent = el("div", {
    class: "hud-percent",
    text: label(game.percent),
    attrs: { "aria-live": "polite" },
  });
  const note = el("p", { class: "game__note", text: "Веди Рыжика пальцем или стрелками" });
  const canvas = el("canvas", { class: "field", attrs: { "aria-label": "Игровое поле" } });
  const stage = el("div", { class: "game__stage" }, [canvas]);
  const view = el("div", { class: "screen screen--game" }, [
    toolbar(level.title, () => navigate("/levels"), percent),
    stage,
    note,
  ]);
  root.append(view);

  const picture = new Image();
  picture.src = level.image;
  void loadMarker();

  let cell = 16;
  let frame = 0;
  let last = performance.now();
  let pointerId: number | null = null;
  let disposed = false;

  const resize = (): void => {
    const sized = sizeCanvas(canvas, stage, game.cols, game.rows);
    cell = sized.cell;
  };
  resize();
  const resizeObs = new ResizeObserver(resize);
  resizeObs.observe(stage);
  requestAnimationFrame(resize);

  const stopWin = game.on("win", () => {
    percent.textContent = "100%";
    note.textContent = "Картинка открыта!";
    void markCompleted(level.id);
    window.setTimeout(() => {
      if (!disposed) navigate(`/win/${level.id}`, { replace: true });
    }, 900);
  });
  const stopCapture = game.on("capture", () => {
    percent.textContent = label(game.percent);
  });
  const stopRewind = game.on("rewind", () => {
    note.textContent = "Ещё раз!";
    window.setTimeout(() => {
      if (!disposed && !game.won) note.textContent = "Веди Рыжика пальцем или стрелками";
    }, 800);
  });

  const tick = (now: number): void => {
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    const ctx = canvas.getContext("2d");
    if (ctx) drawGame(ctx, game, picture.complete ? picture : null, cell, now);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  const point = (event: PointerEvent): void => {
    const at = pointerToCell(canvas, event, cell);
    game.setDragTarget(at.x, at.y);
  };

  const onDown = (event: PointerEvent): void => {
    if (game.won) return;
    pointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    point(event);
    event.preventDefault();
  };
  const onMove = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) return;
    point(event);
    event.preventDefault();
  };
  const onUp = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    game.release();
  };

  const onKey = (event: KeyboardEvent): void => {
    const dir = KEYS[event.key];
    if (!dir) return;
    event.preventDefault();
    if (event.type === "keydown" && !event.repeat) game.setDirection(dir.x, dir.y);
    if (event.type === "keyup") {
      // Stop only if this key matches the current direction.
      if (game.dirX === dir.x && game.dirY === dir.y) game.release();
    }
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    resizeObs.disconnect();
    stopWin();
    stopCapture();
    stopRewind();
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("keyup", onKey);
    view.remove();
  };
}

function label(percent: number): string {
  return `${Math.floor(percent * 100)}%`;
}
