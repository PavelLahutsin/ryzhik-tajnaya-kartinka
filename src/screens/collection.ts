import { worlds } from "../data/levels";
import { navigate } from "../router";
import { loadProgress } from "../storage";
import { el } from "../ui/dom";
import { starRow } from "../ui/icons";
import { toolbar } from "./levels";

export function renderCollection(root: HTMLElement): () => void {
  const list = el("div", { class: "worlds" });
  const empty = el("p", {
    class: "empty",
    text: "Пока пусто. Открой первую картинку — и она появится здесь.",
  });
  const view = el("div", { class: "screen screen--list" }, [
    toolbar("Коллекция", () => navigate("/")),
    empty,
    list,
  ]);
  root.append(view);

  let cancelled = false;
  void loadProgress().then((progress) => {
    if (cancelled) return;
    if (progress.completed.length > 0) empty.hidden = true;
    for (const world of worlds) {
      const done = world.levels.filter((level) => progress.completed.includes(level.id));
      if (done.length === 0) continue;
      const grid = el("div", { class: "level-grid" });
      for (const level of done) {
        grid.append(
          el(
            "button",
            {
              class: "level-card is-done",
              attrs: { type: "button", "aria-label": `Смотреть: ${level.title}` },
              on: { click: () => navigate(`/win/${level.id}`) },
            },
            [
              el("span", { class: "level-card__frame" }, [
                el("img", {
                  class: "level-card__art",
                  attrs: { src: level.image, alt: "", draggable: "false", loading: "lazy" },
                }),
              ]),
              el("span", { class: "level-card__foot" }, [
                el("span", { class: "level-card__name", text: level.title }),
                starRow(progress.stars[level.id] ?? 1),
              ]),
            ],
          ),
        );
      }
      list.append(
        el("section", { class: "world", style: { "--world": world.color } }, [
          el("header", { class: "world__head" }, [
            el("h2", { class: "world__title", text: world.title }),
            el("span", { class: "world__stars", text: `${done.length} из ${world.levels.length}` }),
          ]),
          grid,
        ]),
      );
    }
  });

  return () => {
    cancelled = true;
    view.remove();
  };
}
