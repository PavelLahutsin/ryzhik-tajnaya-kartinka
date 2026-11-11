import markerUrl from "../assets/marker.webp";
import { CAPTURED, FOG, TRAIL } from "./capture";
import type { Game } from "./engine";

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

  for (const enemy of game.enemies) {
    drawBee(ctx, (enemy.x + 0.5) * cell, (enemy.y + 0.5) * cell, cell, now);
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

function drawBee(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  now: number,
): void {
  const r = Math.max(8, cell * 0.36);
  const flap = 0.55 + Math.sin(now * 0.012) * 0.25;
  ctx.save();
  ctx.translate(x, y);

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
  ctx.fillStyle = "#ffd24a";
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.95, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3b2e25";
  ctx.fillRect(-r * 0.18, -r * 0.68, r * 0.16, r * 1.36);
  ctx.fillRect(r * 0.18, -r * 0.6, r * 0.14, r * 1.2);
  ctx.strokeStyle = "#3b2e25";
  ctx.lineWidth = 1.4;
  ctx.stroke();

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
