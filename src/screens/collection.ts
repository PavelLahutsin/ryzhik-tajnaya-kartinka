import { levels } from "../data/levels";
import { navigate } from "../router";
import { loadProgress } from "../storage";
import { el } from "../ui/dom";
import { toolbar } from "./levels";

export function renderCollection(root: HTMLElement): () => void {
  const grid = el("div", { class: "level-grid" });
  const empty = el("p", {
    class: "empty",
    text: "Пока пусто. Открой первую картинку — и она появится здесь.",
  });
  const view = el("div", { class: "screen screen--list" }, [
    toolbar("Коллекция", () => navigate("/")),
    empty,
    grid,
  ]);
  root.append(view);

  let cancelled = false;
  void loadProgress().then((progress) => {
    if (cancelled) return;
    const unlocked = levels.filter((level) => progress.completed.includes(level.id));
    if (unlocked.length === 0) return;
    empty.hidden = true;
    for (const level of unlocked) {
      const card = el(
        "button",
        {
          class: "level-card is-done",
          attrs: { type: "button", "aria-label": `Смотреть: ${level.title}` },
          on: { click: () => navigate(`/win/${level.id}`) },
        },
        [
          el("img", { class: "level-card__art", attrs: { src: level.image, alt: "", draggable: "false" } }),
          el("span", { class: "level-card__name", text: level.title }),
        ],
      );
      grid.append(card);
    }
  });

  return () => {
    cancelled = true;
    view.remove();
  };
}
