import { drawIcon, type IconKind } from "../game/render";
import { el } from "./dom";

/** A small static canvas with one of the game icons, for HUD and cards. */
export function iconCanvas(kind: IconKind, size: number, className = "icon"): HTMLCanvasElement {
  const canvas = el("canvas", { class: className, attrs: { "aria-hidden": "true" } });
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawIcon(ctx, kind, size / 2, size / 2, size * 0.9, 0);
  }
  return canvas;
}

const STAR_PATH =
  "M16 2.5l4.1 8.6 9.4 1.2-6.9 6.5 1.8 9.3L16 23.6l-8.4 4.5 1.8-9.3-6.9-6.5 9.4-1.2z";

/** Row of three stars, `filled` of them lit. */
export function starRow(filled: number, className = "stars"): HTMLElement {
  const row = el("span", {
    class: className,
    attrs: { role: "img", "aria-label": `Звёзд: ${filled} из 3` },
  });
  for (let i = 0; i < 3; i++) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 32 32");
    svg.setAttribute("class", i < filled ? "star is-on" : "star");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", STAR_PATH);
    svg.append(path);
    row.append(svg);
  }
  return row;
}
