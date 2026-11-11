import markerUrl from "../assets/marker.webp";
import { CAPTURED, FOG, TRAIL } from "./capture";
import type { Game, ItemKind } from "./engine";

const FOG_A = "#6db3d4";
const FOG_B = "#5aa3c6";
const TRAIL_FILL = "#ffd56a";
const TRAIL_LINE = "#ff8a3d";

let markerImage: HTMLImageElement | null = null;

export function loadMarker(): Promise<HTMLImageElement> {
  if (markerImage && markerImage.complete) return Promise.resolve(markerImage);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      markerImage = image;
      resolve(image);
    };
    image.onerror = () => reject(new Error("Не загрузился маркер Рыжика"));
    image.src = markerUrl;
  });
}

/** Extra canvas margin so the marker can hang over a border cell. */
export function fieldPad(cell: number): number {
  return Math.round(cell * 0.7);
}

export function sizeCanvas(
  canvas: HTMLCanvasElement,
  stage: HTMLElement,
  cols: number,
  rows: number,
): { width: number; height: number; cell: number; pad: number; dpr: number } {
  const maxW = Math.max(160, stage.clientWidth);
  const maxH = Math.max(120, stage.clientHeight);
  const cell = Math.max(8, Math.floor(Math.min(maxW / (cols + 1.4), maxH / (rows + 1.4))));
  const pad = fieldPad(cell);
  const width = cell * cols + pad * 2;
  const height = cell * rows + pad * 2;
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width, height, cell, pad, dpr };
}

export function drawGame(
  ctx: CanvasRenderingContext2D,
  game: Game,
  picture: HTMLImageElement | null,
  cell: number,
  now: number,
  pad = fieldPad(cell),
): void {
  const { cols, rows, grid } = game;
  const width = cols * cell + pad * 2;
  const height = rows * cell + pad * 2;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(pad, pad);

  const picW = picture?.naturalWidth || 1;
  const picH = picture?.naturalHeight || 1;

  for (let y = 0; y < rows; y++) {
    const row = grid[y]!;
    for (let x = 0; x < cols; x++) {
      const dx = x * cell;
      const dy = y * cell;
      const state = row[x]!;
      if (state === CAPTURED && picture) {
        ctx.drawImage(
          picture,
          (x * picW) / cols,
          (y * picH) / rows,
          picW / cols,
          picH / rows,
          dx,
          dy,
          cell,
          cell,
        );
      } else if (state === TRAIL) {
        ctx.fillStyle = TRAIL_FILL;
        ctx.fillRect(dx, dy, cell, cell);
      } else if (state === FOG) {
        ctx.fillStyle = (x + y) % 2 === 0 ? FOG_A : FOG_B;
        ctx.fillRect(dx, dy, cell, cell);
      } else {
        // Picture has not loaded yet: show a warm placeholder.
        ctx.fillStyle = (x + y) % 2 === 0 ? "#f3e0c4" : "#ecd4b0";
        ctx.fillRect(dx, dy, cell, cell);
      }
    }
  }

  // Soft grid so the field is readable for kids.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < cols; x++) {
    ctx.moveTo(x * cell + 0.5, 0);
    ctx.lineTo(x * cell + 0.5, height);
  }
  for (let y = 1; y < rows; y++) {
    ctx.moveTo(0, y * cell + 0.5);
    ctx.lineTo(width, y * cell + 0.5);
  }
  ctx.stroke();

  // Trail outline on top of the grid.
  ctx.strokeStyle = TRAIL_LINE;
  ctx.lineWidth = Math.max(2, cell * 0.12);
  ctx.lineJoin = "round";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y]![x] !== TRAIL) continue;
      ctx.strokeRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
    }
  }

  // Puddles on the still-closed part of the field.
  for (const index of game.puddles) {
    const x = index % cols;
    const y = Math.floor(index / cols);
    if (grid[y]?.[x] === CAPTURED) continue;
    drawPuddle(ctx, x * cell, y * cell, cell, (x + y) % 2);
  }

  for (const item of game.items) {
    const blink = item.ttl < 3 && Math.floor(now / 180) % 2 === 0;
    if (blink) continue;
    const bob = Math.sin(now * 0.005 + item.x) * cell * 0.06;
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.beginPath();
    ctx.arc((item.x + 0.5) * cell, (item.y + 0.5) * cell, cell * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawIcon(ctx, item.kind, (item.x + 0.5) * cell, (item.y + 0.5) * cell + bob, cell * 1.4, now);
  }

  for (const bug of game.ladybugs) {
    drawLadybug(ctx, (bug.x + 0.5) * cell, (bug.y + 0.5) * cell, cell, now, bug.vx, bug.vy);
  }

  const asleep = game.effects.honey > 0;
  const slow = game.effects.snail > 0;
  for (const enemy of game.enemies) {
    drawBee(ctx, (enemy.x + 0.5) * cell, (enemy.y + 0.5) * cell, cell, now, {
      fast: enemy.kind === "fast",
      asleep,
      slow,
    });
  }

  const px = (game.visualX + 0.5) * cell;
  const py = (game.visualY + 0.5) * cell;
  const pulse = game.rewindPulse;
  if (pulse > 0) {
    ctx.save();
    ctx.globalAlpha = pulse * 0.45;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(px, py, cell * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  drawMarker(ctx, px, py, cell);
  if (game.effects.shield > 0) {
    const fading = game.effects.shield < 2 && Math.floor(now / 160) % 2 === 0;
    if (!fading) drawBubble(ctx, px, py - cell * 0.25, cell * 1.25, now);
  }
  ctx.restore();
}

function drawPuddle(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, alt: number): void {
  ctx.save();
  ctx.fillStyle = alt ? "#3f8fc0" : "#4596c6";
  ctx.fillRect(x, y, cell, cell);
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.beginPath();
  ctx.ellipse(x + cell * 0.5, y + cell * 0.55, cell * 0.32, cell * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, now: number): void {
  ctx.save();
  const wobble = 1 + Math.sin(now * 0.008) * 0.04;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(160, 220, 255, 0.28)";
  ctx.strokeStyle = "rgba(90, 170, 230, 0.9)";
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.beginPath();
  ctx.ellipse(x, y, r * wobble, r / wobble, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.45, y - r * 0.5, r * 0.18, r * 0.1, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, outer: number, inner: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export type IconKind = ItemKind | "puddle" | "fast" | "ladybug";

/** Helper and hazard icons, drawn with plain shapes so no emoji font is needed. */
export function drawIcon(
  ctx: CanvasRenderingContext2D,
  kind: IconKind,
  x: number,
  y: number,
  size: number,
  now: number,
): void {
  const s = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  switch (kind) {
    case "heart": {
      ctx.fillStyle = "#ff5b6b";
      ctx.strokeStyle = "#c23145";
      ctx.lineWidth = Math.max(1.5, s * 0.08);
      ctx.beginPath();
      ctx.moveTo(0, s * 0.75);
      ctx.bezierCurveTo(-s * 1.05, 0, -s * 0.75, -s * 0.85, 0, -s * 0.35);
      ctx.bezierCurveTo(s * 0.75, -s * 0.85, s * 1.05, 0, 0, s * 0.75);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.ellipse(-s * 0.38, -s * 0.28, s * 0.14, s * 0.09, -0.7, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "snail": {
      ctx.fillStyle = "#ffd9a8";
      ctx.strokeStyle = "#8a5a2b";
      ctx.lineWidth = Math.max(1.5, s * 0.07);
      ctx.beginPath();
      ctx.moveTo(-s * 0.85, s * 0.6);
      ctx.quadraticCurveTo(-s * 0.95, s * 0.1, -s * 0.6, s * 0.05);
      ctx.lineTo(s * 0.8, s * 0.55);
      ctx.quadraticCurveTo(s * 0.9, s * 0.65, s * 0.7, s * 0.68);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.72, s * 0.05);
      ctx.lineTo(-s * 0.85, -s * 0.35);
      ctx.moveTo(-s * 0.58, s * 0.05);
      ctx.lineTo(-s * 0.55, -s * 0.35);
      ctx.stroke();
      ctx.fillStyle = "#c77dff";
      ctx.beginPath();
      ctx.arc(s * 0.12, s * 0.05, s * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s * 0.12, s * 0.05, s * 0.3, 0, Math.PI * 1.6);
      ctx.stroke();
      break;
    }
    case "honey": {
      ctx.fillStyle = "#ffb627";
      ctx.strokeStyle = "#a3490d";
      ctx.lineWidth = Math.max(1.5, s * 0.08);
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, -s * 0.35);
      ctx.quadraticCurveTo(-s * 0.85, s * 0.8, 0, s * 0.8);
      ctx.quadraticCurveTo(s * 0.85, s * 0.8, s * 0.6, -s * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e86f2c";
      ctx.fillRect(-s * 0.68, -s * 0.62, s * 1.36, s * 0.3);
      ctx.strokeRect(-s * 0.68, -s * 0.62, s * 1.36, s * 0.3);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.ellipse(-s * 0.3, s * 0.15, s * 0.1, s * 0.22, 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "shield": {
      drawBubble(ctx, 0, 0, s * 0.85, now);
      break;
    }
    case "star": {
      ctx.fillStyle = "#ffd23f";
      ctx.strokeStyle = "#e08a00";
      ctx.lineWidth = Math.max(1.5, s * 0.08);
      ctx.rotate(Math.sin(now * 0.004) * 0.15);
      starPath(ctx, 0, 0, s * 0.9, s * 0.42);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "puddle": {
      ctx.fillStyle = "#4596c6";
      ctx.beginPath();
      ctx.ellipse(0, s * 0.2, s * 0.9, s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.ellipse(-s * 0.2, s * 0.1, s * 0.35, s * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "fast": {
      ctx.restore();
      drawBee(ctx, x, y, size / 0.9, now, { fast: true, asleep: false, slow: false });
      return;
    }
    case "ladybug": {
      ctx.restore();
      drawLadybug(ctx, x, y, size / 0.9, now, 1, 0);
      return;
    }
  }
  ctx.restore();
}

function drawLadybug(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  now: number,
  vx: number,
  vy: number,
): void {
  const r = Math.max(8, cell * 0.46);
  ctx.save();
  ctx.translate(x, y + Math.sin(now * 0.02) * 0.6);
  ctx.rotate(Math.atan2(vy, vx) + Math.PI / 2);
  ctx.fillStyle = "#3b2e25";
  ctx.beginPath();
  ctx.arc(0, -r * 0.8, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff4b3e";
  ctx.strokeStyle = "#3b2e25";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.85);
  ctx.lineTo(0, r * 0.85);
  ctx.stroke();
  ctx.fillStyle = "#3b2e25";
  for (const [dx, dy] of [
    [-0.4, -0.3],
    [0.4, -0.3],
    [-0.42, 0.35],
    [0.42, 0.35],
  ] as const) {
    ctx.beginPath();
    ctx.arc(dx * r, dy * r, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-r * 0.16, -r * 0.92, r * 0.1, 0, Math.PI * 2);
  ctx.arc(r * 0.16, -r * 0.92, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number): void {
  const size = cell * 2.15;
  if (markerImage && markerImage.complete && markerImage.naturalWidth > 0) {
    const ratio = markerImage.naturalWidth / markerImage.naturalHeight;
    const h = size;
    const w = h * ratio;
    ctx.drawImage(markerImage, x - w / 2, y - h * 0.62, w, h);
    return;
  }
  ctx.fillStyle = "#ff8a3d";
  ctx.beginPath();
  ctx.arc(x, y, cell * 0.42, 0, Math.PI * 2);
  ctx.fill();
}

type BeeLook = { fast: boolean; asleep: boolean; slow: boolean };

function drawBee(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  now: number,
  look: BeeLook = { fast: false, asleep: false, slow: false },
): void {
  const r = Math.max(9, cell * 0.48);
  const speed = look.asleep ? 0 : look.slow ? 0.004 : look.fast ? 0.024 : 0.012;
  const flap = look.asleep ? 0.45 : 0.55 + Math.sin(now * speed) * 0.25;
  ctx.save();
  ctx.translate(x, y);
  if (look.fast && !look.asleep) {
    ctx.strokeStyle = "rgba(255, 138, 61, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const dy of [-0.3, 0, 0.3]) {
      ctx.moveTo(-r * 1.2, dy * r);
      ctx.lineTo(-r * 1.75, dy * r);
    }
    ctx.stroke();
  }

  // Wings
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.strokeStyle = "rgba(59, 46, 37, 0.35)";
  ctx.lineWidth = 1.2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * r * 0.55, -r * 0.7 * flap, r * 0.55, r * 0.38 * flap, side * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Body
  ctx.fillStyle = look.fast ? "#ff9a3c" : "#ffd24a";
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.95, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3b2e25";
  ctx.fillRect(-r * 0.18, -r * 0.68, r * 0.16, r * 1.36);
  ctx.fillRect(r * 0.18, -r * 0.6, r * 0.14, r * 1.2);
  ctx.strokeStyle = "#3b2e25";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  if (look.asleep) {
    // Sleepy closed eyes and a little "z".
    ctx.strokeStyle = "#3b2e25";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.1, r * 0.14, 0.2, Math.PI - 0.2);
    ctx.moveTo(r * 0.36, -r * 0.1);
    ctx.arc(r * 0.22, -r * 0.1, r * 0.14, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.fillStyle = "#3b2e25";
    ctx.font = `800 ${Math.round(r * 0.9)}px Nunito, sans-serif`;
    ctx.fillText("z", r * 0.7, -r * 0.75 - Math.sin(now * 0.004) * r * 0.2);
    ctx.restore();
    return;
  }
  // Eyes
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-r * 0.28, -r * 0.08, r * 0.18, 0, Math.PI * 2);
  ctx.arc(r * 0.22, -r * 0.08, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3b2e25";
  ctx.beginPath();
  ctx.arc(-r * 0.24, -r * 0.06, r * 0.08, 0, Math.PI * 2);
  ctx.arc(r * 0.26, -r * 0.06, r * 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Convert a pointer event into grid coordinates, including fractional cell. */
export function pointerToCell(
  canvas: HTMLCanvasElement,
  event: PointerEvent,
  cell: number,
  pad = fieldPad(cell),
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left - pad) / cell,
    y: (event.clientY - rect.top - pad) / cell,
  };
}
