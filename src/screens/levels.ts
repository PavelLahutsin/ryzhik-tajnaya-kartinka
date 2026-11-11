import { isUnlocked, levels } from "../data/levels";
import { navigate } from "../router";
import { loadProgress } from "../storage";
import { el } from "../ui/dom";

export function renderLevels(root: HTMLElement): () => void {
  const grid = el("div", { class: "level-grid" });
  const view = el("div", { class: "screen screen--list" }, [
    toolbar("Картинки", () => navigate("/")),
    grid,
  ]);
  root.append(view);

  let cancelled = false;
  void loadProgress().then((progress) => {
    if (cancelled) return;
    for (const level of levels) {
      const open = isUnlocked(level.id, progress.completed);
      const done = progress.completed.includes(level.id);
      const card = el(
        "button",
        {
          class: `level-card${open ? "" : " is-locked"}${done ? " is-done" : ""}`,
          attrs: {
            type: "button",
            disabled: open ? null : true,
            "aria-label": open
              ? done
                ? `${level.title}, картинка уже открыта`
                : `Играть: ${level.title}`
              : `${level.title}, ещё закрыта`,
          },
          on: {
            click: () => {
              if (open) navigate(`/game/${level.id}`);
            },
          },
        },
        [
          el("img", {
            class: "level-card__art",
            attrs: {
              src: level.image,
              alt: "",
              draggable: "false",
            },
          }),
          el("span", { class: "level-card__name", text: level.title }),
          done ? el("span", { class: "level-card__badge", text: "Открыта" }) : null,
          open ? null : el("span", { class: "level-card__lock", text: "Закрыта", attrs: { "aria-hidden": "true" } }),
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

export function toolbar(title: string, onBack: () => void, extra?: HTMLElement): HTMLElement {
  return el("header", { class: "toolbar" }, [
    el(
      "button",
      {
        class: "btn btn--back",
        attrs: { type: "button", "aria-label": "Назад" },
        on: { click: onBack },
      },
      [el("span", { attrs: { "aria-hidden": "true" }, text: "←" })],
    ),
    el("h1", { class: "toolbar__title", text: title }),
    extra ?? el("span", { class: "toolbar__spacer" }),
  ]);
}
