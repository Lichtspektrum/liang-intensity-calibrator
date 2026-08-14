import "./styles.css";

import "number-flow";

import { type AppController, mountApp } from "./app";
import { fetchTimelineDay, submitVote } from "./api";
import { readInitialState } from "./initial-state";
import { MAX_SCORE, MIN_SCORE } from "./score-domain";
import { createVideoRenderer, type VideoRenderer } from "./video-renderer";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("找不到应用挂载节点");
}

const initialScoreData = readInitialState();
const initialPosterElement = app.querySelector<HTMLImageElement>(".ssr-poster");

if (!initialPosterElement) {
  throw new Error("缺少服务端首帧");
}
const initialPoster = initialPosterElement;

let controller: AppController | null = null;
let renderer: VideoRenderer | null = null;
let fingerprintPromise: Promise<string> | null = null;

function getVoteStorageKey(): string {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
  }).format(new Date());
  return `liang-slider:vote-position:v2:${date}`;
}

function getStoredVotePosition(): number | null {
  const value = Number(localStorage.getItem(getVoteStorageKey()));
  return Number.isInteger(value) && value >= MIN_SCORE && value <= MAX_SCORE
    ? value
    : null;
}

const requestDraw = (score: number): void => {
  renderer?.render(score);
};

controller = mountApp(app, requestDraw, initialPoster);
renderer = createVideoRenderer(controller.canvas);

controller.onVote = async (position: number) => {
  if (!controller) return;
  try {
    const fingerprint = await getFingerprint();
    const result = await submitVote(fingerprint, position);
    if (result.accepted) {
      localStorage.setItem(getVoteStorageKey(), String(result.userPosition));
      controller.setUserVotePosition(result.userPosition);
      controller.setCommunityScore({
        score: result.score,
        stage: result.stage,
        positiveCount: result.positiveCount,
        negativeCount: result.negativeCount,
        neutralCount: result.neutralCount,
        positivePoints: result.positivePoints,
        negativePoints: result.negativePoints,
        isColdStart: true,
        recentEvents: [],
      });
      controller.setVotingState({
        positiveCount: result.positiveCount,
        negativeCount: result.negativeCount,
        neutralCount: result.neutralCount,
        positivePoints: result.positivePoints,
        negativePoints: result.negativePoints,
      });
    }
  } catch {
    // Silently fail - voting is best-effort
  }
};

controller.onHistorySelect = async (date: string) => {
  if (!controller) return;
  try {
    const dayData = await fetchTimelineDay(date);
    controller.enterHistoryMode(date, dayData.score);
  } catch {
    // Timeline fetch failed silently
  }
};

controller.onHistoryExit = () => {
  controller?.exitHistoryMode();
};

function getFingerprint(): Promise<string> {
  fingerprintPromise ??= import("@fingerprintjs/fingerprintjs")
    .then(async ({ default: FingerprintJS }) => {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      return result.visitorId;
    })
    .catch(() => `fallback-${crypto.randomUUID()}`);
  return fingerprintPromise;
}

async function loadInitialView(): Promise<void> {
  if (!controller || !renderer) return;
  try {
    controller.setCommunityScore(initialScoreData);
    const savedPosition = getStoredVotePosition();
    controller.setUserVotePosition(savedPosition);
    controller.setScore(initialScoreData.score);
    await renderer.drawPoster(initialPoster, initialScoreData.score);
    initialPoster.remove();
    controller.setFirstFrameReady();
    await renderer.loadVideo();
    controller.setReady();
  } catch {
    controller.setError("连续画面加载失败，请刷新重试");
  }
}

async function resetLocalVotesFromQuery(): Promise<void> {
  const url = new URL(window.location.href);
  const isLocalDevelopment =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (!isLocalDevelopment || url.searchParams.get("reset") !== "1") return;

  await fetch("/api/score?reset=1", { cache: "no-store" });
  localStorage.removeItem(getVoteStorageKey());
  url.searchParams.delete("reset");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

async function bootstrap(): Promise<void> {
  try {
    await resetLocalVotesFromQuery();
  } catch {
    // Continue loading so an unavailable local reset does not block the app.
  }
  await loadInitialView();
}

void bootstrap();

window.addEventListener("resize", () => {
  renderer?.redraw();
});
