import "./styles.css";

import { type AppController, type AppMode, mountApp } from "./app";
import { ChatRateLimitError, createApiClient, type ModePositionsData, type NewsVariant, type ScoreData, type TimelineDayData, type VoteResult } from "./api";
import { MAX_SCORE, MIN_SCORE } from "./score-domain";
import { easeInOutCubic, scoreTransitionDurationMs } from "./score-transition";
import {
  createVideoRenderer,
  getPosterPath,
  type VideoRenderer,
} from "./video-renderer";

const MANUAL_STORAGE_KEY = "liang-slider:manual-position:v1";
const CHAT_ACTIVE_STORAGE_KEY = "liang-slider:active-chat:v1";
const CHAT_MODEL_STORAGE_KEY = "liang-slider:chat-model:v1";
const FALLBACK_FINGERPRINT_KEY = "liang-slider:fallback-fingerprint:v1";

interface StoredVote {
  position: number;
  nextVoteAt: number;
}

export function parseStoredVote(raw: string | null): StoredVote | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredVote>;
    if (
      !Number.isInteger(value.position)
      || value.position! < MIN_SCORE
      || value.position! > MAX_SCORE
      || typeof value.nextVoteAt !== "number"
      || !Number.isFinite(value.nextVoteAt)
      || value.nextVoteAt < 0
    ) {
      return null;
    }
    return { position: value.position!, nextVoteAt: value.nextVoteAt };
  } catch {
    return null;
  }
}

function saveStoredVote(vote: StoredVote): void {
  const raw = JSON.stringify(vote);
  localStorage.setItem(MANUAL_STORAGE_KEY, raw);
  observedVoteStorageValue = raw;
  activeVote = vote;
}

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("找不到应用挂载节点");

const api = createApiClient(import.meta.env.VITE_API_BASE_URL);
const poster = document.createElement("img");
poster.className = "ssr-poster";
poster.src = getPosterPath(0, import.meta.env.BASE_URL);
poster.alt = "";
poster.setAttribute("aria-hidden", "true");

let controller: AppController | null = null;
let renderer: VideoRenderer | null = null;
let lastCommunityScore = 0;
let activeVote: StoredVote | null = null;
let observedVoteStorageValue: string | null = null;
let newsInFlight = false;
let newsLoaded = false;
let newsVariant: NewsVariant = "quick";
let loadedNewsVariant: NewsVariant | null = null;
let chatInFlight = false;
let appMode: AppMode = "manual";
let chatTransitionGeneration = 0;
let activeConversationId: string | null = null;
let pendingConversationId: string | null = null;
let chatModel: string | null = null;
const modePositions: ModePositionsData = { news: null, chat: null };
const timelineByDate = new Map<string, TimelineDayData>();

const requestDraw = (score: number): void => {
  renderer?.render(score);
};

controller = mountApp(app, requestDraw, poster);
renderer = createVideoRenderer(controller.canvas, import.meta.env.BASE_URL);

function applyCommunityScore(score: ScoreData): void {
  lastCommunityScore = score.score;
  controller?.setCommunityScore(score);
}

function syncActiveVoteFromStorage(): StoredVote | null {
  const raw = localStorage.getItem(MANUAL_STORAGE_KEY);
  if (raw !== observedVoteStorageValue) {
    observedVoteStorageValue = raw;
    activeVote = parseStoredVote(raw);
  }
  return activeVote;
}

function getFallbackFingerprint(): string {
  const stored = localStorage.getItem(FALLBACK_FINGERPRINT_KEY);
  if (stored) return stored;
  const fingerprint = `fallback-${crypto.randomUUID()}`;
  localStorage.setItem(FALLBACK_FINGERPRINT_KEY, fingerprint);
  return fingerprint;
}

let cooldownTimeout: ReturnType<typeof setTimeout> | null = null;
let cooldownDeadline: number | null = null;
let cooldownGeneration = 0;

function showCooldownUntil(nextVoteAt: number, announce = false): void {
  cooldownGeneration += 1;
  const generation = cooldownGeneration;
  if (cooldownTimeout !== null) {
    clearTimeout(cooldownTimeout);
    cooldownTimeout = null;
  }
  cooldownDeadline = nextVoteAt;
  let announced = false;
  const update = (): void => {
    if (generation !== cooldownGeneration) return;
    const remainingMs = Math.max(0, nextVoteAt - Date.now());
    if (announce && !announced) {
      controller?.setCooldown(remainingMs, true);
      announced = true;
    } else {
      controller?.setCooldown(remainingMs);
    }
    if (remainingMs <= 0) {
      cooldownTimeout = null;
      cooldownDeadline = null;
      return;
    }
    const displayedMinutes = Math.ceil(remainingMs / 60_000);
    const nextBoundaryMs = remainingMs - (displayedMinutes - 1) * 60_000;
    cooldownTimeout = setTimeout(update, Math.max(1, nextBoundaryMs));
  };
  update();
}

function clearCooldown(): void {
  cooldownGeneration += 1;
  cooldownDeadline = null;
  if (cooldownTimeout !== null) {
    clearTimeout(cooldownTimeout);
    cooldownTimeout = null;
  }
}

async function submitVote(position: number): Promise<void> {
  if (!controller) return;
  // 未配置 API 时退化为纯本机记忆。
  if (!api.configured) {
    saveStoredVote({ position, nextVoteAt: 0 });
    controller.setUserVotePosition(position);
    controller.restoreVote(position);
    return;
  }
  try {
    const result = await api.submitVote(getFallbackFingerprint(), position);
    if (result.accepted) {
      saveStoredVote({ position, nextVoteAt: result.nextVoteAt });
      controller.setUserVotePosition(position);
      applyCommunityScore(result);
      controller.setVotingState({
        voterCount: result.voterCount,
        todayVoterCount: result.todayVoterCount,
        positiveCount: result.positiveCount,
        negativeCount: result.negativeCount,
        neutralCount: result.neutralCount,
        positivePoints: result.positivePoints,
        negativePoints: result.negativePoints,
      });
      showCooldownUntil(result.nextVoteAt, true);
      controller.restoreVote(position);
      return;
    }

    // 冷却 / 限流等拒绝响应同样携带最新社区状态。
    if (result.reason === "cooldown") {
      applyCommunityScore(result);
      controller.setVotingState({
        voterCount: result.voterCount,
        todayVoterCount: result.todayVoterCount,
        positiveCount: result.positiveCount,
        negativeCount: result.negativeCount,
        neutralCount: result.neutralCount,
        positivePoints: result.positivePoints,
        negativePoints: result.negativePoints,
      });
      saveStoredVote({ position: result.userPosition, nextVoteAt: result.nextVoteAt });
      controller.setUserVotePosition(result.userPosition);
      showCooldownUntil(result.nextVoteAt, true);
      controller.restoreVote(result.userPosition);
      return;
    }
    if (result.reason === "rate_limited") {
      applyCommunityScore(result);
      controller.setVotingState({
        voterCount: result.voterCount,
        todayVoterCount: result.todayVoterCount,
        positiveCount: result.positiveCount,
        negativeCount: result.negativeCount,
        neutralCount: result.neutralCount,
        positivePoints: result.positivePoints,
        negativePoints: result.negativePoints,
      });
      saveStoredVote({ position, nextVoteAt: 0 });
      controller.setUserVotePosition(position);
      controller.restoreVote(position);
      return;
    }
    // invalid_* 只在请求异常时出现；降级为本机记忆。
    saveStoredVote({ position, nextVoteAt: 0 });
    controller.setUserVotePosition(position);
    controller.setVoteError();
    controller.restoreVote(position);
  } catch {
    // 网络失败：保留本机位置，提示稍后重试。
    saveStoredVote({ position, nextVoteAt: 0 });
    controller.setUserVotePosition(position);
    controller.setVoteError();
    controller.restoreVote(position);
  }
}

controller.onVote = (position: number) => {
  if (!controller) return;
  void submitVote(position);
};

async function persistModePositions(): Promise<void> {
  if (!api.configured) return;
  try {
    await api.saveModePositions(modePositions);
  } catch {
    // 本地缓存写入失败不影响核心交互。
  }
}

async function loadModePositions(): Promise<void> {
  if (!api.configured) return;
  try {
    const positions = await api.fetchModePositions();
    modePositions.news = positions.news;
    modePositions.chat = positions.chat;
    controller?.setModePosition("news", positions.news);
    controller?.setModePosition("chat", positions.chat);
  } catch {
    // 读取失败则从空缓存开始。
  }
}

controller.onModePositionChange = (mode, score) => {
  if (mode === "news") modePositions.news = score;
  else if (mode === "chat") modePositions.chat = score;
  void persistModePositions();
};

controller.onHistorySelect = (date: string) => {
  const day = timelineByDate.get(date);
  if (day) controller?.enterHistoryMode(date, day.score);
};

controller.onHistoryExit = () => {
  controller?.exitHistoryMode();
};

const NEWS_PROGRESS_POLL_MS = 650;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadNewsMode(force = false): Promise<void> {
  if (!controller || newsInFlight) return;
  if (!api.configured) {
    controller.setNewsError("AI API 未配置，新闻模式暂不可用");
    return;
  }
  newsInFlight = true;
  controller.setNewsLoading();
  let succeeded = false;
  try {
    let job = await api.startNewsCollection(force, newsVariant);
    controller.setNewsProgress(job);
    while (job.status === "running") {
      await delay(NEWS_PROGRESS_POLL_MS);
      job = await api.fetchNewsProgress(job.id);
      controller.setNewsProgress(job);
    }
    if (job.status !== "completed" || !job.result) {
      throw new Error("news collection failed");
    }
    const result = job.result;
    controller.setScore(result.score);
    controller.setNewsResult(result);
    newsLoaded = true;
    loadedNewsVariant = result.variant ?? "deep";
    controller.setModePosition("news", result.score);
    succeeded = true;
  } catch {
    controller.setNewsError("今天的 AI 新闻暂时读取失败，请稍后重试");
  } finally {
    newsInFlight = false;
  }
  // 加载期间用户切换了版本：成功返回后按新版本补跑一次。
  if (succeeded && appMode === "news" && loadedNewsVariant !== newsVariant) {
    void loadNewsMode();
  }
}

controller.onModeChange = (mode) => {
  appMode = mode;
  chatTransitionGeneration += 1;
};

controller.onNewsRefresh = () => {
  void loadNewsMode(true);
};

// 不按键不开始：进入新闻模式不自动运行，只有按「开始」才启动管道。
controller.onNewsStart = () => {
  void loadNewsMode();
};

controller.onNewsVariantChange = (variant) => {
  newsVariant = variant;
};

// 新闻模式可选定时器：开启后每 30 分钟自动读取一次（服务端 90 分钟缓存有效期内复用）。
const NEWS_AUTO_REFRESH_MS = 30 * 60 * 1_000;
let newsAutoRefreshTimer: ReturnType<typeof setInterval> | null = null;

controller.onNewsTimerChange = (enabled) => {
  if (enabled && !newsAutoRefreshTimer) {
    newsAutoRefreshTimer = setInterval(() => {
      // 首次运行必须由用户按「开始」，定时器只刷新已启动过的结果。
      if (appMode === "news" && newsLoaded) void loadNewsMode();
    }, NEWS_AUTO_REFRESH_MS);
  } else if (!enabled && newsAutoRefreshTimer) {
    clearInterval(newsAutoRefreshTimer);
    newsAutoRefreshTimer = null;
  }
};

controller.onChatSubmit = async (message: string) => {
  if (!controller || chatInFlight) return;
  if (!api.configured) {
    controller.setChatError("AI API 未配置，对话模式暂不可用");
    return;
  }
  const conversationId = activeConversationId ?? pendingConversationId ?? crypto.randomUUID();
  if (!activeConversationId) pendingConversationId = conversationId;
  const submittedFor = conversationId;
  chatInFlight = true;
  controller.setChatLoading(message);
  try {
    const result = await api.chat(message, undefined, conversationId, chatModel ?? undefined);
    pendingConversationId = null;
    if (activeConversationId !== null && activeConversationId !== submittedFor) {
      // 回答期间用户已切换到另一段历史对话：仍已持久化，只刷新列表。
      void refreshConversationList();
      return;
    }
    activeConversationId = conversationId;
    localStorage.setItem(CHAT_ACTIVE_STORAGE_KEY, conversationId);
    controller.setActiveConversationId(conversationId);
    controller.setChatResult(result);
    void refreshConversationList();
    chatInFlight = false;
    const transitionStart = controller.score;
    const generation = ++chatTransitionGeneration;
    await animateChatScore(transitionStart, result.score, generation);
    controller.setModePosition("chat", result.score);
  } catch (error) {
    controller.setChatError(
      error instanceof ChatRateLimitError
        ? "本小时对话次数已用完，请稍后再试"
        : "这次回答没有生成成功，请稍后重试",
    );
  } finally {
    chatInFlight = false;
  }
};

async function refreshConversationList(): Promise<void> {
  if (!controller || !api.configured) return;
  try {
    const conversations = await api.fetchConversations();
    controller.setChatConversations(conversations);
  } catch {
    // 列表刷新失败时保留当前侧边栏视图。
  }
}

async function loadConversation(id: string): Promise<void> {
  if (!controller || !api.configured) return;
  try {
    const conversation = await api.fetchConversation(id);
    activeConversationId = id;
    pendingConversationId = null;
    localStorage.setItem(CHAT_ACTIVE_STORAGE_KEY, id);
    controller.setActiveConversationId(id);
    controller.setChatThread(conversation.messages);
    controller.setChatNotice(`已载入：${conversation.title}`);
    const lastAssistant = [...conversation.messages]
      .reverse()
      .find((message) => message.role === "assistant" && message.score !== null);
    if (lastAssistant?.score !== null && lastAssistant?.score !== undefined) {
      controller.setScore(lastAssistant.score);
      controller.setModePosition("chat", lastAssistant.score);
    }
  } catch {
    controller.setChatError("历史对话读取失败，请稍后重试");
  }
}

function startNewConversation(): void {
  if (!controller) return;
  activeConversationId = null;
  pendingConversationId = null;
  localStorage.removeItem(CHAT_ACTIVE_STORAGE_KEY);
  controller.setActiveConversationId(null);
  controller.clearChatThread();
  controller.setChatNotice("新对话：输入第一个问题后会自动保存到左侧列表。");
  controller.setModePosition("chat", null);
  const baseline = activeVote?.position ?? lastCommunityScore ?? 0;
  controller.setScore(baseline);
}

async function loadConversations(): Promise<void> {
  if (!controller || !api.configured) return;
  try {
    const conversations = await api.fetchConversations();
    controller.setChatConversations(conversations);
    const saved = localStorage.getItem(CHAT_ACTIVE_STORAGE_KEY);
    if (saved && conversations.some((conversation) => conversation.id === saved)) {
      await loadConversation(saved);
    }
  } catch {
    // 历史对话不可用时保持空侧边栏，不阻塞其他功能。
  }
}

controller.onConversationSelect = (id: string) => {
  void loadConversation(id);
};

controller.onConversationDelete = (id: string) => {
  void (async () => {
    if (!api.configured) return;
    try {
      await api.deleteConversation(id);
    } catch {
      // 删除失败不阻塞交互，刷新后仍会显示。
    }
    if (activeConversationId === id) {
      startNewConversation();
    } else {
      void refreshConversationList();
    }
  })();
};

controller.onNewConversation = () => {
  startNewConversation();
};

// 自动发现 opencode 可用模型（参考 super-opencode：`opencode models` → 下拉选择）。
async function loadOpenCodeModels(): Promise<void> {
  if (!controller || !api.configured) return;
  try {
    const { models, active } = await api.fetchOpenCodeModels();
    controller.setOpenCodeModels(models, active);
    const saved = localStorage.getItem(CHAT_MODEL_STORAGE_KEY);
    if (saved && models.includes(saved)) {
      chatModel = saved;
      controller.setSelectedModel(saved);
    } else {
      chatModel = null;
      controller.setSelectedModel(active);
    }
  } catch {
    // 模型列表不可用时静默降级，使用服务端默认模型。
  }
}

controller.onModelChange = (model: string) => {
  chatModel = model;
  localStorage.setItem(CHAT_MODEL_STORAGE_KEY, model);
};

async function animateChatScore(
  from: number,
  to: number,
  generation: number,
): Promise<void> {
  if (!controller || appMode !== "chat") return;
  const durationMs = scoreTransitionDurationMs(from, to);
  if (durationMs === 0) {
    controller.setScore(to);
    return;
  }

  const startedAt = performance.now();
  await new Promise<void>((resolve) => {
    const frame = (now: number): void => {
      if (!controller || appMode !== "chat" || generation !== chatTransitionGeneration) {
        resolve();
        return;
      }

      const progress = Math.min(1, (now - startedAt) / durationMs);
      controller.setScore(from + (to - from) * easeInOutCubic(progress));
      if (progress >= 1) {
        controller.setScore(to);
        resolve();
        return;
      }
      window.requestAnimationFrame(frame);
    };
    window.requestAnimationFrame(frame);
  });
}

function resetLocalVoteFromQuery(): void {
  const url = new URL(window.location.href);
  const isLocalDevelopment = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (!isLocalDevelopment || url.searchParams.get("reset") !== "1") return;

  localStorage.removeItem(MANUAL_STORAGE_KEY);
  activeVote = null;
  observedVoteStorageValue = null;
  url.searchParams.delete("reset");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

async function loadMedia(): Promise<void> {
  if (!controller || !renderer) return;
  try {
    const initialScore = controller.score;
    poster.src = getPosterPath(initialScore, import.meta.env.BASE_URL);
    await renderer.drawPoster(poster, initialScore);
    poster.remove();
    controller.setFirstFrameReady();
    renderer.render(controller.score);
    await renderer.loadVideo();
    controller.setReady();
  } catch {
    controller.setError("连续画面加载失败，请刷新重试");
  }
}

async function loadCommunity(): Promise<void> {
  if (!controller) return;

  if (!api.configured) {
    controller.setCommunityUnavailable();
    return;
  }

  try {
    const score = await api.fetchScore();
    applyCommunityScore(score);
    controller.setVotingState({
      voterCount: score.voterCount,
      todayVoterCount: score.todayVoterCount,
      positiveCount: score.positiveCount,
      negativeCount: score.negativeCount,
      neutralCount: score.neutralCount,
      positivePoints: score.positivePoints,
      negativePoints: score.negativePoints,
    });
    const latestVote = syncActiveVoteFromStorage();
    if (latestVote) {
      controller.setUserVotePosition(latestVote.position);
      controller.restoreVote(latestVote.position);
      if (latestVote.nextVoteAt > Date.now()) {
        showCooldownUntil(latestVote.nextVoteAt);
      }
    }
  } catch {
    controller.setCommunityUnavailable();
  }

  try {
    const days = await api.fetchTimeline();
    timelineByDate.clear();
    days.forEach((day) => timelineByDate.set(day.date, day));
    controller.setTimelineEvents(days.map((day, id) => ({
      id,
      date: day.date,
      title: `${day.stage} · ${day.voterCount} 人`,
      summary: null,
      isMajor: false,
    })));
  } catch {
    // 历史快照缺失不影响社区分数和滑杆。
  }
}

function bootstrap(): void {
  resetLocalVoteFromQuery();
  const currentVote = syncActiveVoteFromStorage();
  controller?.setUserVotePosition(currentVote?.position ?? null);
  if (currentVote) {
    controller?.restoreVote(currentVote.position);
    if (currentVote.nextVoteAt > Date.now()) {
      showCooldownUntil(currentVote.nextVoteAt);
    }
  }
  void loadModePositions();
  void loadMedia();
  void loadCommunity();
  void loadConversations();
  void loadOpenCodeModels();
}

bootstrap();

window.addEventListener("resize", () => {
  renderer?.redraw();
});

