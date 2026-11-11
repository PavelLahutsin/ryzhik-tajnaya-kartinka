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

const HEART_PATH =
  "M16 27.5S4 19.2 4 11.8C4 7.8 7.1 5 10.8 5c2.3 0 4.3 1.2 5.2 3.1C16.9 6.2 18.9 5 21.2 5 24.9 5 28 7.8 28 11.8c0 7.4-12 15.7-12 15.7z";

export function renderGame(root: HTMLElement, levelId: string): () => void {
  const level = getLevel(levelId);
  if (!level) {
    navigate("/levels", { replace: true });
    return () => undefined;
  }

  const game = new Game({
    enemies: level.enemies,
    winPercent: level.winPercent,
    lives: level.lives,
  });
  const percent = el("div", {
    class: "hud-percent",
    text: label(game.percent),
    attrs: { "aria-live": "polite" },
  });
  const livesHud = makeLives(game.maxLives, game.lives);
  const note = el("p", { class: "game__note", text: "Веди Рыжика пальцем или стрелками" });
  const canvas = el("canvas", { class: "field", attrs: { "aria-label": "Игровое поле" } });
  const stage = el("div", { class: "game__stage" }, [canvas]);
  const retryBtn = el("button", {
    class: "btn btn--play",
    text: "Ещё раз",
    attrs: { type: "button" },
  });
  const retry = el(
    "div",
    {
      class: "retry",
      attrs: {
        hidden: "",
        role: "dialog",
        "aria-labelledby": "retry-title",
        "aria-modal": "true",
      },
    },
    [
      el("p", {
        class: "retry__msg",
        text: "Попробуем ещё раз!",
        attrs: { id: "retry-title" },
      }),
      retryBtn,
    ],
  );
  const body = el("div", { class: "game__body" }, [livesHud, stage, note, retry]);
  const view = el("div", { class: "screen screen--game" }, [
    toolbar(level.title, () => navigate("/levels"), percent),
    body,
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

  const paintLives = (lost = false): void => {
    livesHud.setAttribute("aria-label", livesLabel(game.lives, game.maxLives));
    const icons = livesHud.querySelectorAll(".heart");
    icons.forEach((icon, index) => {
      const empty = index >= game.lives;
      icon.classList.toggle("is-empty", empty);
      icon.classList.toggle("is-lost", lost && index === game.lives);
    });
  };

  const showRetry = (): void => {
    retry.removeAttribute("hidden");
    retry.classList.add("is-open");
    retryBtn.focus();
  };

  const hideRetry = (): void => {
    retry.setAttribute("hidden", "");
    retry.classList.remove("is-open");
  };

  const restartLevel = (): void => {
    game.restart();
    percent.textContent = label(game.percent);
    note.textContent = "Веди Рыжика пальцем или стрелками";
    paintLives();
    hideRetry();
    canvas.focus();
  };
  retryBtn.addEventListener("click", restartLevel);

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
    paintLives(true);
    if (game.failed) return;
    note.textContent = "Ещё раз!";
    window.setTimeout(() => {
      if (!disposed && !game.won && !game.failed) {
        note.textContent = "Веди Рыжика пальцем или стрелками";
      }
    }, 800);
  });
  const stopFail = game.on("fail", () => {
    note.textContent = "";
    showRetry();
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
    if (game.won || game.failed) return;
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
    if (game.failed) return;
    const dir = KEYS[event.key];
    if (!dir) return;
    event.preventDefault();
    if (event.type === "keydown" && !event.repeat) game.setDirection(dir.x, dir.y);
    if (event.type === "keyup") {
      // Stop only if this key matches the current direction.
      if (game.dirX === dir.x && game.dirY === dir.y) game.release();
    }
  };

  canvas.tabIndex = 0;
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
    stopFail();
    retryBtn.removeEventListener("click", restartLevel);
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

function livesLabel(left: number, total: number): string {
  const word = left === 1 ? "сердечко" : left >= 2 && left <= 4 ? "сердечка" : "сердечек";
  return `Осталось ${left} ${word} из ${total}`;
}

function makeLives(total: number, left: number): HTMLElement {
  const node = el("div", {
    class: "hud-lives",
    attrs: { role: "img", "aria-label": livesLabel(left, total) },
  });
  for (let i = 0; i < total; i++) node.append(heartIcon(i < left));
  return node;
}

function heartIcon(full: boolean): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 32 32");
  svg.setAttribute("class", full ? "heart" : "heart is-empty");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", HEART_PATH);
  svg.append(path);
  return svg;
}
