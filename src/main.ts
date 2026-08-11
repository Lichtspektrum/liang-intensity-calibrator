import "./styles.css";

import { type AppController, mountApp } from "./app";
import {
  createEvolutionVideoRenderer,
  type EvolutionVideoRenderer,
} from "./video-renderer";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("找不到应用挂载节点");
}

let controller: AppController | null = null;
let renderer: EvolutionVideoRenderer | null = null;

const requestDraw = (level: number): void => {
  renderer?.render(level);
};

controller = mountApp(app, requestDraw);
renderer = createEvolutionVideoRenderer(controller.canvas);
controller.setLoading(0, 1);

renderer
  .load()
  .then(() => {
    controller?.setReady();
    requestDraw(controller?.level ?? 0);
  })
  .catch(() => {
    controller?.setError("图像加载失败，请刷新重试");
  });

window.addEventListener("resize", () => {
  renderer?.redraw();
});
