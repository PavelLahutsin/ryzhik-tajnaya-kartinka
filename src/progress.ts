/** Pure progress helpers (no storage), so they are easy to test. */
export type Progress = {
  completed: string[];
  /** Best stars per level id, 1–3. */
  stars: Record<string, number>;
};

export function emptyProgress(): Progress {
  return { completed: [], stars: {} };
}

export function normalizeProgress(value: unknown): Progress {
  const out = emptyProgress();
  if (!value || typeof value !== "object") return out;
  const raw = value as { completed?: unknown; stars?: unknown };
  if (Array.isArray(raw.completed)) {
    out.completed = raw.completed.filter((id): id is string => typeof id === "string");
  }
  if (raw.stars && typeof raw.stars === "object") {
    for (const [id, n] of Object.entries(raw.stars as Record<string, unknown>)) {
      if (typeof n === "number" && n >= 1) out.stars[id] = Math.min(3, Math.floor(n));
    }
  }
  // Older saves only knew "completed": count those as one star.
  for (const id of out.completed) if (!out.stars[id]) out.stars[id] = 1;
  return out;
}

/** Record a win. Keeps the best star count; never lowers it. */
export function recordWin(progress: Progress, id: string, stars: number): Progress {
  const next: Progress = { completed: [...progress.completed], stars: { ...progress.stars } };
  if (!next.completed.includes(id)) next.completed.push(id);
  const best = Math.max(next.stars[id] ?? 0, Math.min(3, Math.max(1, Math.floor(stars))));
  next.stars[id] = best;
  return next;
}
