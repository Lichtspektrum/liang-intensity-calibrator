import "./styles.css";

import FingerprintJS from "@fingerprintjs/fingerprintjs";
import "number-flow";

import { type AppController, mountApp } from "./app";
import { fetchScore, fetchTimelineDay, submitVote } from "./api";
import {
  createPortraitRenderer,
  type PortraitRenderer,
} from "./portrait-renderer";
import { MAX_SCORE, MIN_SCORE } from "./score-domain";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("找不到应用挂载节点");
}

let controller: AppController | null = null;
let renderer: PortraitRenderer | null = null;
let fingerprint: string | null = null;

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
  void renderer?.render(score).catch(() => {
    controller?.setError("图像加载失败，请刷新重试");
  });
};

controller = mountApp(app, requestDraw);
renderer = createPortraitRenderer(controller.canvas);

controller.onVote = async (position: number) => {
  if (!fingerprint || !controller) return;
  try {
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

async function initFingerprint(): Promise<void> {
  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    fingerprint = result.visitorId;
  } catch {
    fingerprint = `fallback-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  }
}

async function loadInitialScore(): Promise<void> {
  if (!controller || !renderer) return;
  const activeRenderer = renderer;
  try {
    const scoreData = await fetchScore();
    controller.setCommunityScore(scoreData);
    const savedPosition = getStoredVotePosition();
    controller.setUserVotePosition(savedPosition);
    controller.setScore(scoreData.score);
    await activeRenderer.render(scoreData.score);
    controller.setReady();
  } catch {
    controller.setError("加载失败，请刷新重试");
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
  await Promise.all([initFingerprint(), loadInitialScore()]);
}

void bootstrap();

window.addEventListener("resize", () => {
  renderer?.redraw();
});
