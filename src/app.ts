import { clampPosition, getProgression, MAX_LEVEL, STAGES } from "./progression";

export interface AppController {
  readonly canvas: HTMLCanvasElement;
  readonly slider: HTMLInputElement;
  readonly level: number;
  setLevel(level: number): void;
  setLoading(loaded: number, total: number): void;
  setReady(): void;
  setError(message: string): void;
}

export type LevelChangeHandler = (level: number) => void;

function createTicks(): string {
  return Array.from(
    { length: MAX_LEVEL + 1 },
    (_, level) => `<i class="tick" data-level="${level}" aria-hidden="true"></i>`,
  ).join("");
}

function createStageMarkers(): string {
  return STAGES.map(
    (stage, index) =>
      `<li class="stage-marker" data-level="${index * 6}" style="--marker-index: ${index}">${stage}</li>`,
  ).join("");
}

export function mountApp(
  root: HTMLElement,
  onLevelChange: LevelChangeHandler = () => undefined,
): AppController {
  root.innerHTML = `
    <div class="experience" data-stage="0">
      <header class="masthead">
        <div>
          <p class="eyebrow">LIANG INTENSITY CALIBRATOR</p>
          <h1>滑动变祖器</h1>
        </div>
        <div class="level-meter" aria-live="polite">
          <span>梁系强度</span>
          <output class="level-output" for="strength-slider">00 / 30</output>
        </div>
      </header>

      <section class="portrait-zone" aria-labelledby="current-stage-label">
        <p class="stage-ghost" aria-hidden="true">小难梁</p>
        <div class="portrait-shell">
          <div class="imperial-halo" aria-hidden="true"></div>
          <canvas class="portrait-canvas" role="img" aria-label="当前形态：小难梁"></canvas>
          <div class="scan-grid" aria-hidden="true"></div>
          <span class="frame-corner frame-corner--tl" aria-hidden="true"></span>
          <span class="frame-corner frame-corner--tr" aria-hidden="true"></span>
          <span class="frame-corner frame-corner--bl" aria-hidden="true"></span>
          <span class="frame-corner frame-corner--br" aria-hidden="true"></span>
          <div class="load-state" role="status">载入祖力 0 / 31</div>
        </div>

        <div class="stage-readout">
          <span id="current-stage-label">当前状态</span>
          <p class="stage-name" aria-live="polite">小难梁</p>
          <span class="stage-index">阶段 01 / 06</span>
        </div>
      </section>

      <section class="control-panel" aria-label="梁系强度控制">
        <div class="range-wrap">
          <div class="tick-track">${createTicks()}</div>
          <input
            id="strength-slider"
            class="strength-slider"
            type="range"
            min="0"
            max="30"
            step="0.01"
            value="0"
            aria-label="梁系强度"
            aria-valuetext="小难梁，0 级，共 30 级"
            disabled
          />
        </div>
        <ol class="stage-markers">${createStageMarkers()}</ol>
        <p class="drag-hint"><span aria-hidden="true">←</span> 拖动以增强梁系浓度 <span aria-hidden="true">→</span></p>
      </section>

      <footer class="footer-note">
        <span>31 级连续进化</span>
        <span>正脸识别协议：已启用</span>
      </footer>
    </div>
  `;

  const experience = root.querySelector<HTMLElement>(".experience")!;
  const canvas = root.querySelector<HTMLCanvasElement>(".portrait-canvas")!;
  const slider = root.querySelector<HTMLInputElement>("#strength-slider")!;
  const output = root.querySelector<HTMLOutputElement>(".level-output")!;
  const stageName = root.querySelector<HTMLElement>(".stage-name")!;
  const stageGhost = root.querySelector<HTMLElement>(".stage-ghost")!;
  const stageIndex = root.querySelector<HTMLElement>(".stage-index")!;
  const loadState = root.querySelector<HTMLElement>(".load-state")!;
  const ticks = Array.from(root.querySelectorAll<HTMLElement>(".tick"));
  const markers = Array.from(root.querySelectorAll<HTMLElement>(".stage-marker"));
  let currentPosition = 0;

  const setLevel = (rawLevel: number): void => {
    const position = clampPosition(rawLevel);
    const state = getProgression(position);
    currentPosition = position;
    slider.value = String(position);
    slider.setAttribute(
      "aria-valuetext",
      `${state.stage}，${state.level} 级，共 ${MAX_LEVEL} 级`,
    );
    output.textContent = `${String(state.level).padStart(2, "0")} / ${MAX_LEVEL}`;
    stageName.textContent = state.stage;
    stageGhost.textContent = state.stage;
    stageIndex.textContent = `阶段 ${String(state.stageIndex + 1).padStart(2, "0")} / 06`;
    canvas.setAttribute("aria-label", `当前形态：${state.stage}`);
    experience.dataset.stage = String(state.stageIndex);
    experience.style.setProperty("--strength", String(position / MAX_LEVEL));
    experience.style.setProperty("--stage-progress", String(state.localProgress));

    ticks.forEach((tick, index) => {
      tick.classList.toggle("is-active", index <= state.level);
    });
    markers.forEach((marker, index) => {
      marker.classList.toggle("is-current", index === state.stageIndex);
      marker.classList.toggle("is-passed", index < state.stageIndex);
    });

    onLevelChange(position);
  };

  slider.addEventListener("input", () => {
    setLevel(Number(slider.value));
  });

  setLevel(0);

  return {
    canvas,
    slider,
    get level() {
      return currentPosition;
    },
    setLevel,
    setLoading(loaded, total) {
      loadState.textContent = `载入祖力 ${loaded} / ${total}`;
    },
    setReady() {
      slider.disabled = false;
      loadState.hidden = true;
    },
    setError(message) {
      slider.disabled = true;
      loadState.hidden = false;
      loadState.classList.add("is-error");
      loadState.textContent = message;
    },
  };
}
