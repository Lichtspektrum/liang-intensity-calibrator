import "./styles.css";

import { type AppController, type AppMode, mountApp } from "./app";
import { ChatRateLimitError, createApiClient, type ModePositionsData, type ScoreData, type TimelineDayData } from "./api";
import { MAX_SCORE, MIN_SCORE } from "./score-domain";
import { easeInOutCubic, scoreTransitionDurationMs } from "./score-transition";
import {
  createVideoRenderer,
  getPosterPath,
  type VideoRenderer,
} from "./video-renderer";

const MANUAL_STORAGE_KEY = "liang-slider:manual-position:v1";
const CHAT_ACTIVE_STORAGE_KEY = "liang-slider:active-chat:v1";

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
let chatInFlight = false;
let appMode: AppMode = "manual";
let chatTransitionGeneration = 0;
let activeConversationId: string | null = null;
let pendingConversationId: string | null = null;
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

controller.onVote = (position: number) => {
  if (!controller) return;
  saveStoredVote({ position, nextVoteAt: 0 });
  controller.setUserVotePosition(position);
  controller.restoreVote(position);
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
  try {
    let job = await api.startNewsCollection(force);
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
    controller.setModePosition("news", result.score);
  } catch {
    controller.setNewsError("今天的 AI 新闻暂时读取失败，请稍后重试");
  } finally {
    newsInFlight = false;
  }
}

controller.onModeChange = (mode) => {
  appMode = mode;
  chatTransitionGeneration += 1;
  if (mode === "news" && !newsLoaded) void loadNewsMode();
};

controller.onNewsRefresh = () => {
  void loadNewsMode(true);
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
    const result = await api.chat(message, undefined, conversationId);
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
    const latestVote = syncActiveVoteFromStorage();
    if (latestVote) {
      controller.setUserVotePosition(latestVote.position);
      controller.restoreVote(latestVote.position);
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
  }
  void loadModePositions();
  void loadMedia();
  void loadCommunity();
  void loadConversations();
}

bootstrap();

window.addEventListener("resize", () => {
  renderer?.redraw();
});

