import "@fontsource/comfortaa/cyrillic-700.css";
import "@fontsource/comfortaa/latin-700.css";
import "@fontsource/nunito/cyrillic-400.css";
import "@fontsource/nunito/cyrillic-700.css";
import "@fontsource/nunito/cyrillic-800.css";
import "@fontsource/nunito/latin-400.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-800.css";
import "./style.css";

import { platform } from "./platform";
import { startRouter, type Route } from "./router";
import { renderCollection } from "./screens/collection";
import { renderGame } from "./screens/game";
import { renderLevels } from "./screens/levels";
import { renderStart } from "./screens/start";
import { renderWin } from "./screens/win";

type Cleanup = () => void;

const node = document.getElementById("app");
if (!node) throw new Error("Нет #app");
const root: HTMLElement = node;

let cleanup: Cleanup | null = null;

function render(route: Route): void {
  cleanup?.();
  cleanup = null;
  root.replaceChildren();

  switch (route.name) {
    case "start":
      cleanup = renderStart(root);
      break;
    case "levels":
      cleanup = renderLevels(root);
      break;
    case "game":
      cleanup = renderGame(root, route.levelId);
      break;
    case "win":
      cleanup = renderWin(root, route.levelId);
      break;
    case "collection":
      cleanup = renderCollection(root);
      break;
  }
  document.body.dataset.route = route.name;
}

document.addEventListener("dblclick", (event) => event.preventDefault());
document.addEventListener("contextmenu", (event) => event.preventDefault());

startRouter(render);

void platform;
