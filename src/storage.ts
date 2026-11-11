import { platform } from "./platform";

const KEY = "progress";

export type Progress = {
  completed: string[];
};

function normalize(value: Progress | null): Progress {
  if (!value || !Array.isArray(value.completed)) return { completed: [] };
  return { completed: value.completed.filter((id) => typeof id === "string") };
}

export async function loadProgress(): Promise<Progress> {
  return normalize(await platform.storage.get<Progress>(KEY));
}

export async function markCompleted(id: string): Promise<Progress> {
  const progress = await loadProgress();
  if (!progress.completed.includes(id)) progress.completed.push(id);
  await platform.storage.set(KEY, progress);
  return progress;
}
