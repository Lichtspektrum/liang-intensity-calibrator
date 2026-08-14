import NumberFlow from "number-flow";

import type { ScoreData, TimelineEventData } from "./api";
import {
  MAX_SCORE,
  MIN_SCORE,
  SCORE_COUNT,
  SCORES_PER_STAGE,
  STAGES,
  clampScore,
  describeScore,
  formatSignedScore,
  normalizeVotePosition,
} from "./score-domain";

export interface AppController {
  readonly canvas: HTMLCanvasElement;
  readonly slider: HTMLInputElement;
  readonly score: number;
  setScore(score: number): void;
  setDisplayScore(score: number): void;
  setLoading(loaded: number, total: number): void;
  setFirstFrameReady(): void;
  setReady(): void;
  setError(message: string): void;
  setCommunityUnavailable(): void;
  setCooldown(remainingMs: number): void;
  setVoteError(): void;
  restoreVote(position: number): void;
  setCommunityScore(score: ScoreData): void;
  setUserVotePosition(position: number | null): void;
  setVotingState(state: {
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    positivePoints: number;
    negativePoints: number;
  }): void;
  setTimelineEvents(events: TimelineEventData[]): void;
  enterHistoryMode(date: string, score: number): void;
  exitHistoryMode(): void;
  onVote?: (position: number) => void;
  onHistorySelect?: (date: string) => void;
  onHistoryExit?: () => void;
}

export type ScoreChangeHandler = (score: number) => void;
export type VoteHandler = (position: number) => void;
export type HistorySelectHandler = (date: string) => void;

function createTicks(): string {
  return Array.from(
    { length: SCORE_COUNT },
    (_, index) => {
      const score = MIN_SCORE + index;
      return `<i class="tick" data-score="${score}" aria-hidden="true"></i>`;
    },
  ).join("");
}

function createStageMarkers(): string {
  return STAGES.map(
    (stage, index) =>
      `<li class="stage-marker" data-score="${MIN_SCORE + index * SCORES_PER_STAGE}" style="--marker-index: ${index}">${stage}</li>`,
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

function formatStatusScore(score: number): string {
  const rounded = Math.round(clampScore(score) * 10) / 10;
  if (Object.is(rounded, -0) || rounded === 0) return "0";
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

export function mountApp(
  root: HTMLElement,
  onScoreChange: ScoreChangeHandler = () => undefined,
  initialPoster?: HTMLImageElement,
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
            <output class="level-output" for="strength-slider">--</output>
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
              <p class="vote-status" role="status" aria-live="polite">红色圆点是你的选择，灰色圆点是社区平均分</p>
              <div class="range-wrap">
                <div class="tick-track">${createTicks()}</div>
                <span class="community-ghost-thumb" aria-label="社区当前分值" title="社区当前分值" hidden></span>
                <input
                  id="strength-slider"
                  class="strength-slider"
                  type="range"
                  min="-15"
                  max="15"
                  step="0.01"
                  value="0"
                  aria-label="梁系强度"
                  aria-valuetext="梁子，强度 00，范围 -15 到 +15"
                  disabled
                />
              </div>
              <ol class="stage-markers">${createStageMarkers()}</ol>
            </div>
            <output class="vote-total vote-total--up" aria-label="高强度累计票值">
              <number-flow class="vote-total-flow" value="0"></number-flow>
            </output>
          </div>
          <p class="drag-hint"><span aria-hidden="true">←</span> 拖动红色圆点，松开即提交。−15 最弱，0 居中，+15 最强；每 3 小时可修改一次。 <span aria-hidden="true">→</span></p>
        </section>

        <footer class="footer-note">
          <span>31 级连续进化</span>
          <span>正脸识别协议：已启用</span>
        </footer>
      </div>
      ${createTimelinePanel()}
    </div>
  `;
  if (initialPoster) {
    root.querySelector(".portrait-shell")?.append(initialPoster);
  }
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
  const voteStatus = root.querySelector<HTMLElement>(".vote-status")!;
  const communityGhostThumb = root.querySelector<HTMLElement>(".community-ghost-thumb")!;

  const timelineTrack = root.querySelector<HTMLElement>(".timeline-track")!;
  const timelineReturnBtn = root.querySelector<HTMLButtonElement>(".timeline-return-btn")!;
  const timelineHeader = root.querySelector<HTMLElement>(".timeline-header")!;

  let previewPosition = 0;
  let displayPosition = 0;
  let currentMode: "idle" | "previewing-vote" | "viewing-history" = "idle";
  let communityLevel = 0;
  let userVotePosition: number | null = null;
  let communityStatus: "unknown" | "available" | "unavailable" = "unknown";
  let actionStatus: "normal" | "cooldown" | "error" = "normal";
  let cooldownRemainingMs = 0;

  const renderVoteStatus = (): void => {
    if (actionStatus === "error") {
      voteStatus.dataset.state = "error";
      voteStatus.textContent = "提交失败，请稍后重试";
      return;
    }

    if (actionStatus === "cooldown") {
      voteStatus.dataset.state = "cooldown";
      const totalMinutes = Math.ceil(cooldownRemainingMs / 60_000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const duration = hours > 0 && minutes > 0
        ? `${hours} 小时 ${minutes} 分`
        : hours > 0
          ? `${hours} 小时`
          : `${minutes} 分`;
      voteStatus.textContent = `还需 ${duration}才能修改投票`;
      return;
    }

    if (communityStatus === "unavailable") {
      voteStatus.dataset.state = "community-unavailable";
      voteStatus.textContent = "社区数据暂时无法加载";
      return;
    }

    voteStatus.dataset.state = "normal";
    if (userVotePosition === null) {
      voteStatus.textContent = "红色圆点是你的选择，灰色圆点是社区平均分";
      return;
    }

    if (communityStatus === "unknown") {
      voteStatus.textContent = `你的投票：${formatStatusScore(userVotePosition)}　社区平均加载中`;
      return;
    }

    voteStatus.textContent =
      `你的投票：${formatStatusScore(userVotePosition)}`
      + `　社区平均：${formatStatusScore(communityLevel)}`;
  };

  const updateVotePoints = (element: NumberFlow, value: number): void => {
    element.setAttribute("value", String(value));
    if (typeof element.update === "function") {
      element.update(value);
      return;
    }
    element.textContent = formatVoteCount(value);
  };

  const updateVisuals = (score: number) => {
    const state = describeScore(score);
    slider.setAttribute(
      "aria-valuetext",
      `${state.stage}，强度 ${formatSignedScore(state.displayScore)}，范围 -15 到 +15`,
    );
    output.textContent = formatSignedScore(state.displayScore);
    stageName.textContent = state.stage;
    stageGhost.textContent = state.stage;
    stageIndex.textContent = `阶段 ${String(state.stageIndex + 1).padStart(2, "0")} / 06`;
    canvas.setAttribute("aria-label", `当前形态：${state.stage}`);
    experience.dataset.stage = String(state.stageIndex);
    experience.style.setProperty("--strength", String(state.trackProgress));
    experience.style.setProperty("--stage-progress", String(state.stageProgress));

    ticks.forEach((tick, index) => {
      tick.classList.toggle("is-active", index <= state.frameIndex);
    });
    markers.forEach((marker, index) => {
      marker.classList.toggle("is-current", index === state.stageIndex);
      marker.classList.toggle("is-passed", index < state.stageIndex);
    });
  };

  const setDisplayScore = (rawScore: number): void => {
    const position = clampScore(rawScore);
    displayPosition = position;
    updateVisuals(position);
    onScoreChange(position);
  };

  const setScore = (rawScore: number): void => {
    previewPosition = clampScore(rawScore);
    setDisplayScore(previewPosition);
    slider.value = String(previewPosition);
  };

  slider.addEventListener("input", () => {
    if (currentMode === "viewing-history") return;
    currentMode = "previewing-vote";
    const position = Number(slider.value);
    previewPosition = clampScore(position);
    setDisplayScore(position);
  });

  slider.addEventListener("change", () => {
    if (currentMode === "previewing-vote") {
      currentMode = "idle";
      const controller = (root as HTMLElement & { _controller?: AppController })._controller;
      controller?.onVote?.(normalizeVotePosition(previewPosition));
    }
  });

  timelineReturnBtn.addEventListener("click", () => {
    const controller = (root as any)._controller as AppController;
    controller.onHistoryExit?.();
  });

  setScore(0);

  const controller: AppController = {
    canvas,
    slider,
    get score() {
      return displayPosition;
    },
    setScore,
    setDisplayScore,
    setLoading(loaded, total) {
      loadState.textContent = loaded >= total ? "连续祖力已就绪" : "载入连续祖力…";
    },
    setFirstFrameReady() {
      loadState.hidden = true;
    },
    setReady() {
      slider.disabled = false;
    },
    setError(message) {
      slider.disabled = true;
      loadState.hidden = false;
      loadState.classList.add("is-error");
      loadState.textContent = message;
    },
    setCommunityUnavailable() {
      communityStatus = "unavailable";
      communityGhostThumb.hidden = true;
      renderVoteStatus();
    },
    setCooldown(remainingMs) {
      if (remainingMs <= 0) {
        actionStatus = "normal";
        cooldownRemainingMs = 0;
        renderVoteStatus();
        return;
      }

      actionStatus = "cooldown";
      cooldownRemainingMs = remainingMs;
      renderVoteStatus();
    },
    setVoteError() {
      actionStatus = "error";
      renderVoteStatus();
    },
    restoreVote(position) {
      if (currentMode === "previewing-vote" || currentMode === "viewing-history") return;
      currentMode = "idle";
      setScore(position);
    },
    setCommunityScore(scoreData) {
      communityLevel = scoreData.score;
      communityStatus = "available";
      communityGhostThumb.hidden = false;
      renderVoteStatus();
      const communityState = describeScore(communityLevel);
      communityGhostThumb.style.setProperty(
        "--community-position",
        String(communityState.trackProgress * 100),
      );
      communityGhostThumb.setAttribute("aria-label", `社区当前分值 ${communityLevel.toFixed(2)}`);
      if (currentMode === "idle" && actionStatus === "normal") {
        setScore(userVotePosition ?? communityLevel);
      }
      controller.setVotingState({
        positiveCount: scoreData.positiveCount,
        negativeCount: scoreData.negativeCount,
        neutralCount: scoreData.neutralCount,
        positivePoints: scoreData.positivePoints,
        negativePoints: scoreData.negativePoints,
      });
    },
    setUserVotePosition(position) {
      userVotePosition = position === null ? null : clampScore(position);
      renderVoteStatus();
    },
    setVotingState(state) {
      updateVotePoints(voteCountUp, state.positivePoints);
      updateVotePoints(voteCountDown, Math.abs(state.negativePoints));
      voteCountUp.setAttribute("aria-label", `正向累计票值 ${state.positivePoints}`);
      voteCountDown.setAttribute("aria-label", `负向累计票值 ${state.negativePoints}`);
    },
    setTimelineEvents(events) {
      const nodes = events.map((event) => {
        const node = document.createElement("button");
        node.className = `timeline-node timeline-node--${event.isMajor ? "major" : "minor"}`;
        node.dataset.date = event.date;
        node.dataset.title = event.title;
        node.setAttribute("aria-label", `${event.date}: ${event.title}`);

        const dot = document.createElement("span");
        dot.className = "timeline-node-dot";
        const label = document.createElement("span");
        label.className = "timeline-node-label";
        label.textContent = event.date.slice(5);
        node.append(dot, label);
        node.addEventListener("click", () => {
          controller.onHistorySelect?.(event.date);
        });
        return node;
      });
      timelineTrack.replaceChildren(...nodes);
    },
    enterHistoryMode(date, score) {
      currentMode = "viewing-history";
      setScore(score);
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
      setScore(userVotePosition ?? communityLevel);
    },
  };

  (root as any)._controller = controller;
  return controller;
}
