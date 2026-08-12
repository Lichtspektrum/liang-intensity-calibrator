import NumberFlow from "number-flow";

import { clampPosition, getProgression, MAX_LEVEL, STAGES } from "./progression";
import type { ScoreData, TimelineEventData } from "./api";

export interface AppController {
  readonly canvas: HTMLCanvasElement;
  readonly slider: HTMLInputElement;
  readonly level: number;
  setLevel(level: number): void;
  setLoading(loaded: number, total: number): void;
  setReady(): void;
  setError(message: string): void;
  setCommunityScore(score: ScoreData): void;
  setVotingState(state: {
    upCount: number;
    downCount: number;
    upVotePoints: number;
    downVotePoints: number;
  }): void;
  setTimelineEvents(events: TimelineEventData[]): void;
  enterHistoryMode(date: string, level: number): void;
  exitHistoryMode(): void;
  onVote?: (position: number) => void;
  onHistorySelect?: (date: string) => void;
  onHistoryExit?: () => void;
}

export type LevelChangeHandler = (level: number) => void;
export type VoteHandler = (position: number) => void;
export type HistorySelectHandler = (date: string) => void;

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

function createTimelinePanel(): string {
  return `
    <aside class="timeline-panel" aria-label="梁系强度时间线">
      <div class="timeline-header">时间线</div>
      <div class="timeline-track"></div>
      <button class="timeline-return-btn" hidden>回到实时</button>
    </aside>
  `;
}

export function formatVoteCount(count: number): string {
  if (count < 1_000) return String(count);

  const units = [
    { value: 1_000_000_000, suffix: "B" },
    { value: 1_000_000, suffix: "M" },
    { value: 1_000, suffix: "K" },
  ];
  const unit = units.find(({ value }) => count >= value)!;
  const compact = count / unit.value;
  const digits = compact < 10 ? 1 : 0;
  return `${compact.toFixed(digits).replace(/\.0$/, "")}${unit.suffix}`;
}

export function mountApp(
  root: HTMLElement,
  onLevelChange: LevelChangeHandler = () => undefined,
): AppController {
  root.innerHTML = `
    <div class="experience" data-stage="0">
      <div class="center-content">
        <header class="masthead">
          <div>
            <p class="eyebrow">LIANG INTENSITY CALIBRATOR</p>
            <h1>滑动变祖器</h1>
          </div>
          <div class="level-meter" aria-live="polite">
            <span>梁系强度</span>
            <output class="level-output" for="strength-slider">-- / 30</output>
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
            <div class="load-state" role="status">载入连续祖力…</div>
          </div>

          <div class="stage-readout">
            <span id="current-stage-label">当前状态</span>
            <p class="stage-name" aria-live="polite">小难梁</p>
            <span class="stage-index">阶段 01 / 06</span>
          </div>
        </section>

        <section class="control-panel" aria-label="梁系强度控制">
          <div class="slider-vote-layout" aria-label="梁氏浓度投票">
            <output class="vote-total vote-total--down" aria-label="低强度累计票值">
              <number-flow class="vote-total-flow" value="0"></number-flow>
            </output>
            <div class="range-control">
              <div class="range-wrap">
                <div class="tick-track">${createTicks()}</div>
                <span class="community-arrow" aria-label="社区当前分值" title="社区当前分值">↓</span>
                <input
                  id="strength-slider"
                  class="strength-slider"
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value="0"
                  aria-label="梁系强度"
                  aria-valuetext="小难梁，0 级，共 30 级"
                  disabled
                />
              </div>
              <ol class="stage-markers">${createStageMarkers()}</ol>
            </div>
            <output class="vote-total vote-total--up" aria-label="高强度累计票值">
              <number-flow class="vote-total-flow" value="0"></number-flow>
            </output>
          </div>
          <p class="drag-hint"><span aria-hidden="true">←</span> 0 为最低、30 为最高；当天再次滑动会修改你的投票 <span aria-hidden="true">→</span></p>
        </section>

        <footer class="footer-note">
          <span>31 级连续进化</span>
          <span>正脸识别协议：已启用</span>
        </footer>
      </div>
      ${createTimelinePanel()}
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

  const voteCountUp = root.querySelector<NumberFlow>(".vote-total--up number-flow")!;
  const voteCountDown = root.querySelector<NumberFlow>(".vote-total--down number-flow")!;
  const communityArrow = root.querySelector<HTMLElement>(".community-arrow")!;

  const timelineTrack = root.querySelector<HTMLElement>(".timeline-track")!;
  const timelineReturnBtn = root.querySelector<HTMLButtonElement>(".timeline-return-btn")!;
  const timelineHeader = root.querySelector<HTMLElement>(".timeline-header")!;

  let currentPosition = 0;
  let currentMode: "idle" | "voting" | "viewing-history" = "idle";
  let communityLevel = 0;
  let hasUserPosition = false;

  const updateVotePoints = (element: NumberFlow, value: number): void => {
    element.setAttribute("value", String(value));
    if (typeof element.update === "function") {
      element.update(value);
      return;
    }
    element.textContent = formatVoteCount(value);
  };

  const updateVisuals = (position: number) => {
    const state = getProgression(position);
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
  };

  const setLevel = (rawLevel: number): void => {
    const position = clampPosition(rawLevel);
    currentPosition = position;
    updateVisuals(position);
    onLevelChange(position);
  };

  slider.addEventListener("input", () => {
    if (currentMode === "viewing-history") return;
    currentMode = "voting";
    hasUserPosition = true;
    setLevel(Number(slider.value));
  });

  slider.addEventListener("change", () => {
    if (currentMode === "voting") {
      currentMode = "idle";
      const controller = (root as HTMLElement & { _controller?: AppController })._controller;
      controller?.onVote?.(currentPosition);
    }
  });

  timelineReturnBtn.addEventListener("click", () => {
    const controller = (root as any)._controller as AppController;
    controller.onHistoryExit?.();
  });

  setLevel(0);

  const controller: AppController = {
    canvas,
    slider,
    get level() {
      return currentPosition;
    },
    setLevel,
    setLoading(loaded, total) {
      loadState.textContent = loaded >= total ? "连续祖力已就绪" : "载入连续祖力…";
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
    setCommunityScore(scoreData) {
      communityLevel = scoreData.level;
      communityArrow.style.setProperty("--community-position", String((communityLevel / MAX_LEVEL) * 100));
      communityArrow.setAttribute("aria-label", `社区当前分值 ${communityLevel.toFixed(2)}`);
      if (!hasUserPosition && currentMode === "idle") {
        setLevel(communityLevel);
      }
      controller.setVotingState({
        upCount: scoreData.upCount,
        downCount: scoreData.downCount,
        upVotePoints: scoreData.upVotePoints,
        downVotePoints: scoreData.downVotePoints,
      });
      controller.setTimelineEvents(scoreData.recentEvents);
    },
    setVotingState(state) {
      updateVotePoints(voteCountUp, state.upVotePoints);
      updateVotePoints(voteCountDown, state.downVotePoints);
      voteCountUp.setAttribute("aria-label", `高强度累计票值 ${state.upVotePoints}`);
      voteCountDown.setAttribute("aria-label", `低强度累计票值 ${state.downVotePoints}`);
    },
    setTimelineEvents(events) {
      const maxImpact = 1;
      timelineTrack.innerHTML = events.map((e) => {
        const size = e.isMajor ? "major" : "minor";
        const dateLabel = e.date.slice(5);
        return `<button class="timeline-node timeline-node--${size}" data-date="${e.date}" data-title="${e.title}" aria-label="${e.date}: ${e.title}">
          <span class="timeline-node-dot"></span>
          <span class="timeline-node-label">${dateLabel}</span>
        </button>`;
      }).join("");

      timelineTrack.querySelectorAll<HTMLButtonElement>(".timeline-node").forEach((node) => {
        node.addEventListener("click", () => {
          const date = node.dataset.date!;
          controller.onHistorySelect?.(date);
        });
      });
    },
    enterHistoryMode(date, level) {
      currentMode = "viewing-history";
      setLevel(level);
      slider.disabled = true;
      timelineReturnBtn.hidden = false;
      experience.classList.add("is-history-mode");
      timelineHeader.textContent = date;
    },
    exitHistoryMode() {
      currentMode = "idle";
      slider.disabled = false;
      timelineReturnBtn.hidden = true;
      experience.classList.remove("is-history-mode");
      timelineHeader.textContent = "时间线";
      setLevel(communityLevel);
    },
  };

  (root as any)._controller = controller;
  return controller;
}
