import { isUnlocked, worlds, type Level } from "../data/levels";
import { totalStars } from "../game/stars";
import { navigate } from "../router";
import { loadProgress, type Progress } from "../storage";
import { el } from "../ui/dom";
import { starRow } from "../ui/icons";

export function renderLevels(root: HTMLElement): () => void {
  const list = el("div", { class: "worlds" });
  const view = el("div", { class: "screen screen--list" }, [
    toolbar("Картинки", () => navigate("/")),
    list,
  ]);
  root.append(view);

  let cancelled = false;
  void loadProgress().then((progress) => {
    if (cancelled) return;
    let focus: HTMLElement | null = null;
    for (const world of worlds) {
      const ids = world.levels.map((level) => level.id);
      const grid = el("div", { class: "level-grid" });
      const firstOpen = isUnlocked(world.levels[0]!.id, progress.completed);
      const section = el(
        "section",
        {
          class: `world${firstOpen ? "" : " is-locked"}`,
          style: { "--world": world.color },
          attrs: { "aria-label": world.title },
        },
        [
          el("header", { class: "world__head" }, [
            el("h2", { class: "world__title", text: world.title }),
            el("span", {
              class: "world__stars",
              text: `★ ${totalStars(progress.stars, ids)} из ${ids.length * 3}`,
            }),
          ]),
          grid,
        ],
      );
      for (const level of world.levels) {
        const card = levelCard(level, progress);
        if (!focus && card.classList.contains("is-next")) focus = card;
        grid.append(card);
      }
      list.append(section);
    }
    // Bring the next level to play into view.
    focus?.scrollIntoView({ block: "center" });
  });

  return () => {
    cancelled = true;
    view.remove();
  };
}

function levelCard(level: Level, progress: Progress): HTMLElement {
  const open = isUnlocked(level.id, progress.completed);
  const done = progress.completed.includes(level.id);
  const stars = progress.stars[level.id] ?? 0;
  const state = done ? " is-done" : open ? " is-next" : " is-locked";
  return el(
    "button",
    {
      class: `level-card${state}`,
      attrs: {
        type: "button",
        disabled: open ? null : true,
        "aria-label": open
          ? done
            ? `${level.title}, звёзд: ${stars} из 3`
            : `Играть: ${level.title}`
          : `Картинка ${level.number}, ещё закрыта`,
      },
      on: {
        click: () => {
          if (open) navigate(`/game/${level.id}`);
        },
      },
    },
    [
      el("span", { class: "level-card__frame" }, [
        // A picture stays secret until it is opened: blurred when next, hidden when locked.
        open
          ? el("img", {
              class: "level-card__art",
              attrs: { src: level.image, alt: "", draggable: "false", loading: "lazy" },
            })
          : el("span", { class: "level-card__art level-card__mystery", text: "?" }),
        el("span", { class: "level-card__num", text: String(level.number) }),
        done ? null : open ? el("span", { class: "level-card__play", attrs: { "aria-hidden": "true" } }) : null,
      ]),
      el("span", { class: "level-card__foot" }, [
        el("span", { class: "level-card__name", text: done ? level.title : open ? "Тайная картинка" : "Закрыта" }),
        done ? starRow(stars) : null,
      ]),
    ],
  );
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
