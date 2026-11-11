import { getLevel, isUnlocked, nextLevel } from "../data/levels";
import { navigate } from "../router";
import { loadProgress } from "../storage";
import { el } from "../ui/dom";
import { toolbar } from "./levels";

export function renderWin(root: HTMLElement, levelId: string): () => void {
  const level = getLevel(levelId);
  if (!level) {
    navigate("/levels", { replace: true });
    return () => undefined;
  }

  const next = nextLevel(level.id);
  const nextBtn = el(
    "button",
    {
      class: "btn btn--play",
      attrs: { type: "button", hidden: true },
      on: { click: () => navigate(`/game/${next?.id}`) },
    },
    [el("span", { text: "Дальше" })],
  );

  const view = el("div", { class: "screen screen--win" }, [
    toolbar("Картинка открыта!", () => navigate("/levels")),
    el("div", { class: "win__art-wrap" }, [
      el("img", {
        class: "win__art",
        attrs: { src: level.image, alt: level.title, draggable: "false" },
      }),
    ]),
    el("div", { class: "win__actions" }, [
      nextBtn,
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
  ]);
  root.append(view);

  let cancelled = false;
  void loadProgress().then((progress) => {
    if (cancelled || !next) return;
    if (isUnlocked(next.id, progress.completed) || progress.completed.includes(level.id)) {
      nextBtn.hidden = false;
    }
  });

  return () => {
    cancelled = true;
    view.remove();
  };
}
