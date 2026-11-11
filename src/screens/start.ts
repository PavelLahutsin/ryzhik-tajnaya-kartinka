import heroUrl from "../assets/hero.webp";
import { levels } from "../data/levels";
import { totalStars } from "../game/stars";
import { navigate } from "../router";
import { loadProgress } from "../storage";
import { el } from "../ui/dom";

export function renderStart(root: HTMLElement): () => void {
  const score = el("p", { class: "start__score", attrs: { hidden: true } });
  void loadProgress().then((progress) => {
    if (progress.completed.length === 0) return;
    const ids = levels.map((level) => level.id);
    const opened = progress.completed.filter((id) => ids.includes(id)).length;
    score.textContent = `Картинок: ${opened} из ${ids.length} · ★ ${totalStars(progress.stars, ids)}`;
    score.hidden = false;
  });
  const view = el("div", { class: "screen screen--start" }, [
    el("img", {
      class: "hero",
      attrs: { src: heroUrl, alt: "Лисёнок Рыжик машет лапкой", draggable: "false" },
    }),
    el("div", { class: "start__copy" }, [
      el("p", { class: "eyebrow", text: "Игра с Рыжиком" }),
      el("h1", { class: "title", text: "Тайная картинка" }),
      el("p", { class: "lead", text: "Веди Рыжика и открывай спрятанные картинки." }),
      score,
      el("div", { class: "start__actions" }, [
        el(
          "button",
          {
            class: "btn btn--play",
            attrs: { type: "button" },
            on: { click: () => navigate("/levels") },
          },
          [el("span", { text: "Играть" })],
        ),
        el(
          "button",
          {
            class: "btn btn--ghost",
            attrs: { type: "button" },
            on: { click: () => navigate("/collection") },
          },
          [el("span", { text: "Коллекция" })],
        ),
      ]),
    ]),
  ]);
  root.append(view);
  return () => view.remove();
}
