import "./styles.css";

import "number-flow";

import { type AppController, mountApp } from "./app";
import { createApiClient, type ScoreData, type TimelineDayData } from "./api";
import { MAX_SCORE, MIN_SCORE } from "./score-domain";
import {
  createVideoRenderer,
  getPosterPath,
  type VideoRenderer,
} from "./video-renderer";

const VOTE_STORAGE_KEY = "liang-slider:vote:v3";
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
  localStorage.setItem(VOTE_STORAGE_KEY, raw);
  observedVoteStorageValue = raw;
  activeVote = vote;
}

function getFallbackFingerprint(): string {
  const stored = localStorage.getItem(FALLBACK_FINGERPRINT_KEY);
  if (stored) return stored;
  const fingerprint = `fallback-${crypto.randomUUID()}`;
  localStorage.setItem(FALLBACK_FINGERPRINT_KEY, fingerprint);
  return fingerprint;
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
let fingerprintPromise: Promise<string> | null = null;
let lastCommunityScore = 0;
let communityRevision = 0;
let cooldownTimeout: ReturnType<typeof setTimeout> | null = null;
let cooldownDeadline: number | null = null;
let cooldownGeneration = 0;
let activeVote: StoredVote | null = null;
let observedVoteStorageValue: string | null = null;
let voteInFlight = false;
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

function applyVoteCommunityScore(score: ScoreData): void {
  communityRevision += 1;
  applyCommunityScore(score);
}

function syncActiveVoteFromStorage(): StoredVote | null {
  const raw = localStorage.getItem(VOTE_STORAGE_KEY);
  if (raw !== observedVoteStorageValue) {
    observedVoteStorageValue = raw;
    activeVote = parseStoredVote(raw);
  }
  return activeVote;
}

function showCooldownUntil(nextVoteAt: number): void {
  cooldownGeneration += 1;
  const generation = cooldownGeneration;
  if (cooldownTimeout !== null) {
    clearTimeout(cooldownTimeout);
    cooldownTimeout = null;
  }

  cooldownDeadline = nextVoteAt;
  const update = (): void => {
    if (generation !== cooldownGeneration) return;
    const remainingMs = Math.max(0, nextVoteAt - Date.now());
    controller?.setCooldown(remainingMs);
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

function showVoteError(): void {
  clearCooldown();
  controller?.setVoteError();
}

function recalibrateCooldown(): void {
  if (cooldownDeadline !== null) showCooldownUntil(cooldownDeadline);
}

function getFingerprint(): Promise<string> {
  fingerprintPromise ??= import("@fingerprintjs/fingerprintjs")
    .then(async ({ default: FingerprintJS }) => {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      return result.visitorId;
    })
    .catch(getFallbackFingerprint);
  return fingerprintPromise;
}

controller.onVote = async (position: number) => {
  if (!controller) return;

  const currentVote = syncActiveVoteFromStorage();
  if (currentVote && Date.now() < currentVote.nextVoteAt) {
    controller.restoreVote(currentVote.position);
    showCooldownUntil(currentVote.nextVoteAt);
    return;
  }

  const fallbackPosition = currentVote?.position ?? lastCommunityScore;
  if (voteInFlight) {
    controller.restoreVote(fallbackPosition);
    return;
  }

  if (!api.configured) {
    controller.restoreVote(fallbackPosition);
    showVoteError();
    return;
  }

  voteInFlight = true;
  try {
    const result = await api.submitVote(await getFingerprint(), position);
    if (result.accepted) {
      saveStoredVote({ position: result.userPosition, nextVoteAt: result.nextVoteAt });
      controller.setUserVotePosition(result.userPosition);
      applyVoteCommunityScore(result);
      controller.restoreVote(result.userPosition);
      showCooldownUntil(result.nextVoteAt);
      return;
    }

    if (result.reason === "cooldown") {
      activeVote = { position: result.userPosition, nextVoteAt: result.nextVoteAt };
      applyVoteCommunityScore(result);
      controller.setUserVotePosition(result.userPosition);
      controller.restoreVote(result.userPosition);
      showCooldownUntil(result.nextVoteAt);
      return;
    }

    if (result.reason === "rate_limited") {
      applyVoteCommunityScore(result);
    }

    controller.restoreVote(fallbackPosition);
    showVoteError();
  } catch {
    controller.restoreVote(fallbackPosition);
    showVoteError();
  } finally {
    voteInFlight = false;
  }
};

controller.onHistorySelect = (date: string) => {
  const day = timelineByDate.get(date);
  if (day) controller?.enterHistoryMode(date, day.score);
};

controller.onHistoryExit = () => {
  controller?.exitHistoryMode();
};

function resetLocalVoteFromQuery(): void {
  const url = new URL(window.location.href);
  const isLocalDevelopment = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (!isLocalDevelopment || url.searchParams.get("reset") !== "1") return;

  localStorage.removeItem(VOTE_STORAGE_KEY);
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

  const revisionAtRequest = communityRevision;
  try {
    const score = await api.fetchScore();
    if (communityRevision === revisionAtRequest) {
      applyCommunityScore(score);
      const latestVote = syncActiveVoteFromStorage();
      if (latestVote) {
        controller.setUserVotePosition(latestVote.position);
        controller.restoreVote(latestVote.position);
        if (latestVote.nextVoteAt > Date.now()) {
          showCooldownUntil(latestVote.nextVoteAt);
        }
      }
    }
  } catch {
    if (communityRevision === revisionAtRequest) {
      controller.setCommunityUnavailable();
    }
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
    // 时间线缺失不影响社区分数和滑杆。
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
  void loadMedia();
  void loadCommunity();
}

bootstrap();

window.addEventListener("resize", () => {
  renderer?.redraw();
});

window.addEventListener("focus", recalibrateCooldown);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") recalibrateCooldown();
});
