import DOMPurify from "dompurify";
import { marked } from "marked";

import type {
  ChatData,
  ConversationMessageData,
  ConversationSummaryData,
  NewsCalibrationData,
  NewsItemData,
  NewsJobData,
  ScoreData,
  TimelineEventData,
} from "./api";
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
  setVoteError(): void;
  restoreVote(position: number): void;
  setCommunityScore(score: ScoreData): void;
  setUserVotePosition(position: number | null): void;
  setTimelineEvents(events: TimelineEventData[]): void;
  setAppMode(mode: AppMode): void;
  setModePosition(mode: AppMode, score: number | null): void;
  setNewsLoading(): void;
  setNewsProgress(progress: NewsJobData): void;
  setNewsResult(result: NewsCalibrationData): void;
  setNewsError(message: string): void;
  setChatLoading(message: string): void;
  setChatResult(result: ChatData): void;
  setChatError(message: string): void;
  setChatNotice(message: string): void;
  setChatConversations(conversations: ConversationSummaryData[]): void;
  setActiveConversationId(id: string | null): void;
  setChatThread(messages: ConversationMessageData[]): void;
  clearChatThread(): void;
  setOpenCodeModels(models: string[], active: string): void;
  setSelectedModel(model: string): void;
  enterHistoryMode(date: string, score: number): void;
  exitHistoryMode(): void;
  onVote?: (position: number) => void;
  onHistorySelect?: (date: string) => void;
  onHistoryExit?: () => void;
  onModeChange?: (mode: AppMode) => void;
  onModePositionChange?: (mode: AppMode, score: number) => void;
  onNewsRefresh?: () => void;
  onChatSubmit?: (message: string) => void;
  onConversationSelect?: (id: string) => void;
  onConversationDelete?: (id: string) => void;
  onNewConversation?: () => void;
  onModelChange?: (model: string) => void;
}

export type AppMode = "manual" | "news" | "chat";

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
    <aside class="timeline-panel" aria-label="梁系强度">
      <div class="timeline-header"></div>
      <div class="timeline-track"></div>
      <button class="timeline-return-btn" hidden>回到实时</button>
    </aside>
  `;
}

function formatStatusScore(score: number): string {
  const rounded = Math.round(clampScore(score) * 10) / 10;
  if (Object.is(rounded, -0) || rounded === 0) return "0";
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function markdownText(value: string): string {
  return value.replace(/([\\`*_{}\[\]()#+.!|<>-])/gu, "\\$1");
}

export function newsItemsMarkdown(items: NewsItemData[]): string {
  return items.slice(0, 12).map((item) => [
    `### [${markdownText(item.title)}](${item.url})`,
    `_${markdownText(item.source)} · ${markdownText(item.tags.join(" / ") || "AI")}_`,
    markdownText(item.summaryZh),
  ].join("\n\n")).join("\n\n---\n\n");
}

function renderSafeNewsMarkdown(container: HTMLElement, items: NewsItemData[]): void {
  const html = marked.parse(newsItemsMarkdown(items), { async: false }) as string;
  container.innerHTML = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["h3", "p", "a", "em", "strong", "code", "hr", "ul", "ol", "li", "br"],
    ALLOWED_ATTR: ["href", "title"],
  });
  container.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
    link.target = "_blank";
    link.rel = "noreferrer";
  });
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
          <div class="masthead-side">
            <nav class="mode-switch" aria-label="校准模式">
              <button class="mode-btn is-active" type="button" data-mode="manual">手动</button>
              <button class="mode-btn" type="button" data-mode="news">今日 AI 新闻</button>
              <button class="mode-btn" type="button" data-mode="chat">梁式对话</button>
            </nav>
            <div class="level-meter" aria-live="polite">
              <span>梁系强度</span>
              <output class="level-output" for="strength-slider">--</output>
            </div>
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
          <div class="slider-layout" aria-label="梁系强度变阻器">
            <div class="range-control">
              <p class="calibration-status" role="status" aria-live="polite">拖动滑片即可连续校准，当前位置会保存在本机</p>
              <div class="rheostat-scale">
                <div class="tick-track">${createTicks()}</div>
                <ol class="stage-markers">${createStageMarkers()}</ol>
              </div>
              <div class="range-wrap">
                <img class="rheostat-chassis" src="${import.meta.env.BASE_URL}assets/rheostat-design-b-chassis.png" alt="" aria-hidden="true" />
                <div class="rheostat-rail-overlay">
                  <span class="rheostat-wiper" aria-hidden="true"></span>
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
              </div>
            </div>
          </div>
          <p class="drag-hint"><span aria-hidden="true">←</span> 拖动滑片连续校准。−15 最弱，0 居中，+15 最强；松开后记住当前位置。 <span aria-hidden="true">→</span></p>
          <section class="mode-panel news-panel" aria-live="polite" hidden>
            <div class="mode-panel-header">
              <div>
                <span class="mode-kicker">NEWS MODE</span>
                <h2>今天的 AI，梁到哪了？</h2>
              </div>
              <button class="news-refresh-btn" type="button">重新读取</button>
            </div>
            <p class="news-status">准备读取今天发布的 AI 新闻。</p>
            <section class="news-progress" aria-label="新闻采集进度" hidden>
              <div class="news-progress-heading">
                <div>
                  <span class="news-progress-kicker">LIVE PIPELINE</span>
                  <strong class="news-progress-label">建立今日采集任务</strong>
                </div>
                <output class="news-progress-percent">0%</output>
              </div>
              <div class="news-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <span class="news-progress-fill"></span>
                <span class="news-progress-glow" aria-hidden="true"></span>
              </div>
              <p class="news-progress-detail">准备可信源、日期边界与梁文锋分析 skill</p>
              <div class="news-progress-metrics" aria-label="采集统计">
                <span><b class="metric-sources">0/3</b> 可信源</span>
                <span><b class="metric-direct">0</b> 直连</span>
                <span><b class="metric-web">0</b> 搜索</span>
                <span><b class="metric-unique">0</b> 有效</span>
                <span><b class="metric-elapsed">0s</b> 已用时</span>
              </div>
              <ol class="news-progress-events" aria-label="详细采集步骤"></ol>
            </section>
            <div class="news-result" hidden>
              <section class="news-analysis">
                <span class="news-column-kicker">LIANG CALIBRATION</span>
                <h3 class="news-headline"></h3>
                <p class="news-rationale"></p>
                <blockquote class="news-quote"></blockquote>
                <p class="news-caveat"></p>
              </section>
              <aside class="news-feed" aria-label="采集到的 AI 新闻">
                <div class="news-feed-heading">
                  <span class="news-column-kicker">GATHERED NEWS · MARKDOWN</span>
                  <b class="news-feed-count"></b>
                </div>
                <div class="news-markdown"></div>
              </aside>
            </div>
          </section>
          <section class="mode-panel chat-panel" hidden>
            <div class="mode-panel-header">
              <div>
                <span class="mode-kicker">CHAT MODE</span>
                <h2>输入一个问题或判断</h2>
              </div>
            </div>
            <div class="chat-body">
              <aside class="chat-sidebar" aria-label="历史对话">
                <button class="chat-new-btn" type="button">新对话</button>
                <ol class="chat-conversations" aria-label="历史对话列表"></ol>
                <p class="chat-sidebar-empty" hidden>还没有历史对话</p>
              </aside>
              <div class="chat-main">
                <div class="chat-thread" role="log" aria-label="连续梁式对话" aria-live="polite">
                  <p class="chat-empty">历史对话会保留在左侧列表，每次回答都会记录当时的强度分值。</p>
                </div>
                <label class="chat-model-row">
                  <span class="chat-model-label">模型</span>
                  <select class="chat-model-select" aria-label="选择 opencode 模型"></select>
                </label>
                <p class="chat-status" role="status" aria-live="polite"></p>
                <form class="chat-form">
                  <textarea id="chat-input" maxlength="2000" rows="3" placeholder="例如：我们应该先追求用户规模，还是继续投入底层模型？ Enter 发送，Shift+Enter 换行" required></textarea>
                  <p class="chat-privacy">由本项目 npm 安装的 OpenCode CLI 处理。免费额度用尽时可切换模型（列表自动来自 opencode models 命令）。</p>
                  <button class="chat-submit-btn" type="submit" aria-label="发送">
                    <svg class="chat-submit-icon chat-submit-icon--send" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 19 19 5M19 5H8.5M19 5v10.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    <svg class="chat-submit-icon chat-submit-icon--stop" viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="5.5" y="5.5" width="13" height="13" rx="2" fill="currentColor" />
                    </svg>
                  </button>
                </form>
              </div>
            </div>
          </section>
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

  const calibrationStatus = root.querySelector<HTMLElement>(".calibration-status")!;

  const timelineTrack = root.querySelector<HTMLElement>(".timeline-track")!;
  const timelineReturnBtn = root.querySelector<HTMLButtonElement>(".timeline-return-btn")!;
  const timelineHeader = root.querySelector<HTMLElement>(".timeline-header")!;
  const modeButtons = Array.from(root.querySelectorAll<HTMLButtonElement>(".mode-btn"));
  const newsPanel = root.querySelector<HTMLElement>(".news-panel")!;
  const newsStatus = root.querySelector<HTMLElement>(".news-status")!;
  const newsResult = root.querySelector<HTMLElement>(".news-result")!;
  const newsHeadline = root.querySelector<HTMLElement>(".news-headline")!;
  const newsRationale = root.querySelector<HTMLElement>(".news-rationale")!;
  const newsQuote = root.querySelector<HTMLElement>(".news-quote")!;
  const newsCaveat = root.querySelector<HTMLElement>(".news-caveat")!;
  const newsMarkdown = root.querySelector<HTMLElement>(".news-markdown")!;
  const newsFeedCount = root.querySelector<HTMLElement>(".news-feed-count")!;
  const newsProgress = root.querySelector<HTMLElement>(".news-progress")!;
  const newsProgressLabel = root.querySelector<HTMLElement>(".news-progress-label")!;
  const newsProgressPercent = root.querySelector<HTMLOutputElement>(".news-progress-percent")!;
  const newsProgressTrack = root.querySelector<HTMLElement>(".news-progress-track")!;
  const newsProgressFill = root.querySelector<HTMLElement>(".news-progress-fill")!;
  const newsProgressDetail = root.querySelector<HTMLElement>(".news-progress-detail")!;
  const newsProgressEvents = root.querySelector<HTMLOListElement>(".news-progress-events")!;
  const metricSources = root.querySelector<HTMLElement>(".metric-sources")!;
  const metricDirect = root.querySelector<HTMLElement>(".metric-direct")!;
  const metricWeb = root.querySelector<HTMLElement>(".metric-web")!;
  const metricUnique = root.querySelector<HTMLElement>(".metric-unique")!;
  const metricElapsed = root.querySelector<HTMLElement>(".metric-elapsed")!;
  const newsRefreshButton = root.querySelector<HTMLButtonElement>(".news-refresh-btn")!;
  const chatPanel = root.querySelector<HTMLElement>(".chat-panel")!;
  const chatForm = root.querySelector<HTMLFormElement>(".chat-form")!;
  const chatInput = root.querySelector<HTMLTextAreaElement>("#chat-input")!;
  const chatSubmitButton = root.querySelector<HTMLButtonElement>(".chat-submit-btn")!;
  const chatStatus = root.querySelector<HTMLElement>(".chat-status")!;
  const chatThread = root.querySelector<HTMLElement>(".chat-thread")!;
  const chatNewButton = root.querySelector<HTMLButtonElement>(".chat-new-btn")!;
  const chatConversations = root.querySelector<HTMLOListElement>(".chat-conversations")!;
  const chatSidebarEmpty = root.querySelector<HTMLElement>(".chat-sidebar-empty")!;
  const chatModelSelect = root.querySelector<HTMLSelectElement>(".chat-model-select")!;

  let previewPosition = 0;
  let displayPosition = 0;
  let currentMode: "idle" | "previewing-vote" | "viewing-history" = "idle";
  let appMode: AppMode = "manual";
  let activeConversationId: string | null = null;
  const modePositions: Partial<Record<AppMode, number>> = {};
  let mediaReady = false;
  let communityLevel = 0;
  let userVotePosition: number | null = null;
  let communityStatus: "unknown" | "available" | "unavailable" = "unknown";
  let actionStatus: "normal" | "error" = "normal";

  const renderVoteStatus = (): void => {
    if (appMode === "news") {
      calibrationStatus.dataset.state = "automatic";
      calibrationStatus.textContent = "由今日 AI 新闻自动校准，变阻器将跟随分析结果";
      return;
    }

    if (appMode === "chat") {
      calibrationStatus.dataset.state = "automatic";
      calibrationStatus.textContent = "由当前对话自动校准，变阻器将平滑移动到分析结果";
      return;
    }

    if (actionStatus === "error") {
      calibrationStatus.dataset.state = "error";
      calibrationStatus.textContent = "在线状态暂不可用，仍可继续手动校准";
      return;
    }

    calibrationStatus.dataset.state = "normal";
    calibrationStatus.textContent = "拖动滑片即可连续校准，当前位置会保存在本机";
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
    experience.style.setProperty("--slider-position", `${state.trackProgress * 100}%`);

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

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.mode as AppMode;
      const controller = (root as HTMLElement & { _controller?: AppController })._controller;
      controller?.setAppMode(mode);
      controller?.onModeChange?.(mode);
    });
  });

  newsRefreshButton.addEventListener("click", () => {
    const controller = (root as HTMLElement & { _controller?: AppController })._controller;
    controller?.onNewsRefresh?.();
  });

  chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;
    const controller = (root as HTMLElement & { _controller?: AppController })._controller;
    controller?.onChatSubmit?.(message);
  });

  // Enter 发送；Shift+Enter 换行；输入法组词回车不触发提交。
  chatInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    chatForm.requestSubmit();
  });

  chatNewButton.addEventListener("click", () => {
    const controller = (root as HTMLElement & { _controller?: AppController })._controller;
    controller?.onNewConversation?.();
  });

  chatModelSelect.addEventListener("change", () => {
    const controller = (root as HTMLElement & { _controller?: AppController })._controller;
    controller?.onModelChange?.(chatModelSelect.value);
  });

  const appendAssistantTurn = (
    container: HTMLElement,
    content: string,
    score: number | null,
    stage: string | null,
  ): void => {
    const assistantTurn = document.createElement("article");
    assistantTurn.className = "chat-turn chat-turn--assistant";
    const answer = document.createElement("p");
    answer.className = "chat-answer";
    answer.textContent = content;
    assistantTurn.append(answer);
    if (score !== null) {
      const badge = document.createElement("span");
      badge.className = "chat-turn-score";
      badge.textContent = `${stage ?? describeScore(score).stage} · ${formatStatusScore(score)}`;
      assistantTurn.append(badge);
    }
    container.append(assistantTurn);
  };

  const renderConversationList = (conversations: ConversationSummaryData[]): void => {
    chatSidebarEmpty.hidden = conversations.length > 0;
    const nodes = conversations.map((conversation) => {
      const item = document.createElement("li");
      item.className = "chat-conversation";
      item.dataset.id = conversation.id;
      if (conversation.id === activeConversationId) item.classList.add("is-active");

      const open = document.createElement("button");
      open.className = "chat-conversation-open";
      open.type = "button";
      open.setAttribute("aria-label", `打开对话：${conversation.title}`);
      const title = document.createElement("strong");
      title.textContent = conversation.title;
      const meta = document.createElement("span");
      meta.className = "chat-conversation-meta";
      const metaParts = [`${conversation.messageCount} 条`];
      if (conversation.lastScore !== null) {
        metaParts.push(`${conversation.lastStage ?? describeScore(conversation.lastScore).stage} ${formatStatusScore(conversation.lastScore)}`);
      }
      meta.textContent = metaParts.join(" · ");
      open.append(title, meta);
      open.addEventListener("click", () => {
        controller.onConversationSelect?.(conversation.id);
      });

      const remove = document.createElement("button");
      remove.className = "chat-conversation-delete";
      remove.type = "button";
      remove.setAttribute("aria-label", `删除对话：${conversation.title}`);
      remove.textContent = "×";
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        controller.onConversationDelete?.(conversation.id);
      });

      item.append(open, remove);
      return item;
    });
    chatConversations.replaceChildren(...nodes);
  };

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
      mediaReady = true;
      slider.disabled = appMode !== "manual" || currentMode === "viewing-history";
    },
    setError(message) {
      slider.disabled = true;
      loadState.hidden = false;
      loadState.classList.add("is-error");
      loadState.textContent = message;
    },
    setCommunityUnavailable() {
      communityStatus = "unavailable";
      actionStatus = "error";
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
      renderVoteStatus();
      if (currentMode === "idle" && actionStatus === "normal") {
        setScore(userVotePosition ?? communityLevel);
      }
    },
    setUserVotePosition(position) {
      userVotePosition = position === null ? null : clampScore(position);
      renderVoteStatus();
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
    setAppMode(mode) {
      appMode = mode;
      experience.dataset.mode = mode;
      modeButtons.forEach((button) => {
        const active = button.dataset.mode === mode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      newsPanel.hidden = mode !== "news";
      chatPanel.hidden = mode !== "chat";
      slider.disabled = !mediaReady || mode !== "manual" || currentMode === "viewing-history";
      if (mode === "manual" && currentMode !== "viewing-history") {
        setScore(userVotePosition ?? communityLevel);
      } else if ((mode === "news" || mode === "chat") && currentMode !== "viewing-history") {
        const saved = modePositions[mode];
        if (saved !== undefined) setScore(saved);
      }
      renderVoteStatus();
    },
    setModePosition(mode, score) {
      if (score === null || !Number.isFinite(score)) {
        delete modePositions[mode];
      } else {
        modePositions[mode] = clampScore(score);
      }
      const value = modePositions[mode];
      if (value !== undefined) controller.onModePositionChange?.(mode, value);
    },
    setNewsLoading() {
      newsRefreshButton.disabled = true;
      newsStatus.dataset.state = "loading";
      newsStatus.textContent = "正在建立可核验的今日 AI 新闻视图…";
      newsProgress.hidden = false;
      newsProgress.dataset.state = "running";
    },
    setNewsProgress(job) {
      newsProgress.hidden = false;
      newsProgress.dataset.state = job.status;
      newsProgress.style.setProperty("--news-progress", String(job.progress / 100));
      newsProgressLabel.textContent = job.label;
      newsProgressPercent.textContent = `${Math.round(job.progress)}%`;
      newsProgressDetail.textContent = job.detail;
      newsProgressTrack.setAttribute("aria-valuenow", String(Math.round(job.progress)));
      newsProgressFill.style.width = `${job.progress}%`;
      metricSources.textContent = `${job.stats.sourcesCompleted ?? 0}/${job.stats.sourcesTotal ?? 3}`;
      metricDirect.textContent = String(job.stats.directItems ?? 0);
      metricWeb.textContent = String(job.stats.webItems ?? 0);
      metricUnique.textContent = String(job.stats.uniqueItems ?? 0);
      metricElapsed.textContent = `${Math.max(0, Math.round(job.elapsedMs / 1_000))}s`;
      const eventNodes = job.events.slice(-8).map((event, index, events) => {
        const item = document.createElement("li");
        const isLatest = index === events.length - 1;
        item.className = isLatest && job.status === "running" ? "is-active" : "is-complete";
        const dot = document.createElement("i");
        dot.setAttribute("aria-hidden", "true");
        const copy = document.createElement("div");
        const label = document.createElement("strong");
        label.textContent = event.label;
        const detail = document.createElement("span");
        detail.textContent = event.detail;
        const percent = document.createElement("time");
        percent.textContent = `${event.progress}%`;
        copy.append(label, detail);
        item.append(dot, copy, percent);
        return item;
      });
      newsProgressEvents.replaceChildren(...eventNodes);
    },
    setNewsResult(result) {
      newsRefreshButton.disabled = false;
      newsStatus.dataset.state = "ready";
      newsStatus.textContent = `${result.date} · ${result.items.length} 条有效信号`;
      newsResult.hidden = false;
      newsProgress.dataset.state = "completed";
      newsHeadline.textContent = result.headline;
      newsRationale.textContent = result.rationale;
      newsQuote.replaceChildren();
      const quoteText = document.createTextNode(`“${result.quote.text}”`);
      newsQuote.append(quoteText);
      newsCaveat.replaceChildren(document.createTextNode(`${result.sourceCaveat} `));
      const transcriptLink = document.createElement("a");
      transcriptLink.href = result.transcriptSource;
      transcriptLink.target = "_blank";
      transcriptLink.rel = "noreferrer";
      transcriptLink.textContent = "查看时间戳归档";
      newsCaveat.append(transcriptLink);
      newsFeedCount.textContent = `${result.items.length} 条`;
      renderSafeNewsMarkdown(newsMarkdown, result.items);
    },
    setNewsError(message) {
      newsRefreshButton.disabled = false;
      newsStatus.dataset.state = "error";
      newsStatus.textContent = message;
      newsProgress.dataset.state = "failed";
    },
    setChatLoading(message) {
      chatSubmitButton.disabled = true;
      chatSubmitButton.classList.add("is-loading");
      chatSubmitButton.setAttribute("aria-label", "生成中");
      chatInput.disabled = true;
      chatInput.value = "";
      chatStatus.dataset.state = "loading";
      chatStatus.hidden = true;
      chatThread.querySelector(".chat-empty")?.remove();
      const userTurn = document.createElement("article");
      userTurn.className = "chat-turn chat-turn--user";
      userTurn.textContent = message;
      const pendingTurn = document.createElement("article");
      pendingTurn.className = "chat-turn chat-turn--assistant is-pending";
      pendingTurn.textContent = "正在思考…";
      chatThread.append(userTurn, pendingTurn);
      chatThread.scrollTop = chatThread.scrollHeight;
    },
    setChatResult(result) {
      chatSubmitButton.disabled = false;
      chatSubmitButton.classList.remove("is-loading");
      chatSubmitButton.setAttribute("aria-label", "发送");
      chatInput.disabled = false;
      chatStatus.dataset.state = "ready";
      chatStatus.hidden = false;
      chatStatus.textContent = `${result.stage} · ${formatStatusScore(result.score)}`;
      chatThread.querySelector(".is-pending")?.remove();
      appendAssistantTurn(chatThread, result.answer, result.score, result.stage);
      chatThread.scrollTop = chatThread.scrollHeight;
      chatInput.focus();
    },
    setChatError(message) {
      chatSubmitButton.disabled = false;
      chatSubmitButton.classList.remove("is-loading");
      chatSubmitButton.setAttribute("aria-label", "发送");
      chatInput.disabled = false;
      chatThread.querySelector(".is-pending")?.remove();
      chatStatus.dataset.state = "error";
      chatStatus.hidden = false;
      chatStatus.textContent = message;
    },
    setChatNotice(message) {
      chatStatus.dataset.state = "ready";
      chatStatus.hidden = false;
      chatStatus.textContent = message;
    },
    setChatConversations(conversations) {
      renderConversationList(conversations);
    },
    setActiveConversationId(id) {
      activeConversationId = id;
      chatConversations.querySelectorAll<HTMLElement>(".chat-conversation").forEach((item) => {
        item.classList.toggle("is-active", item.dataset.id === id);
      });
    },
    setChatThread(messages) {
      chatThread.replaceChildren();
      for (const message of messages) {
        if (message.role === "user") {
          const userTurn = document.createElement("article");
          userTurn.className = "chat-turn chat-turn--user";
          userTurn.textContent = message.content;
          chatThread.append(userTurn);
        } else {
          appendAssistantTurn(chatThread, message.content, message.score, message.stage);
        }
      }
      chatThread.scrollTop = chatThread.scrollHeight;
    },
    clearChatThread() {
      chatThread.replaceChildren();
      const empty = document.createElement("p");
      empty.className = "chat-empty";
      empty.textContent = "新对话会保留在左侧列表，每次回答都会记录当时的强度分值。";
      chatThread.append(empty);
    },
    setOpenCodeModels(models, active) {
      chatModelSelect.replaceChildren();
      if (models.length === 0) {
        // 自动发现失败：退化为只展示当前生效模型（禁用选择）。
        const option = document.createElement("option");
        option.value = active;
        option.textContent = active;
        chatModelSelect.append(option);
        chatModelSelect.disabled = true;
        return;
      }
      chatModelSelect.disabled = false;
      for (const model of models) {
        const option = document.createElement("option");
        option.value = model;
        option.textContent = model;
        chatModelSelect.append(option);
      }
      if (!models.includes(chatModelSelect.value)) {
        chatModelSelect.value = models.includes(active) ? active : models[0]!;
      }
    },
    setSelectedModel(model) {
      if (chatModelSelect.disabled) return;
      const exists = Array.from(chatModelSelect.options).some((option) => option.value === model);
      if (exists) chatModelSelect.value = model;
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
      slider.disabled = !mediaReady || appMode !== "manual";
      timelineReturnBtn.hidden = true;
      experience.classList.remove("is-history-mode");
      timelineHeader.textContent = "";
      setScore(userVotePosition ?? communityLevel);
    },
  };

  (root as any)._controller = controller;
  return controller;
}
