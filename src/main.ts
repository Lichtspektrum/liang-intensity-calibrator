import "./styles.css";

import FingerprintJS from "@fingerprintjs/fingerprintjs";
import "number-flow";

import { type AppController, mountApp } from "./app";
import { fetchScore, fetchTimelineDay, submitVote } from "./api";
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
let fingerprint: string | null = null;

function getVoteStorageKey(): string {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
  }).format(new Date());
  return `liang-slider:vote-position:${date}`;
}

function getStoredVotePosition(): number | null {
  const value = Number(localStorage.getItem(getVoteStorageKey()));
  return Number.isInteger(value) && value >= 0 && value <= 30 ? value : null;
}

const requestDraw = (level: number): void => {
  renderer?.render(level);
};

controller = mountApp(app, requestDraw);
renderer = createEvolutionVideoRenderer(controller.canvas);
controller.setLoading(0, 1);

controller.onVote = async (position: number) => {
  if (!fingerprint || !controller) return;
  try {
    const result = await submitVote(fingerprint, position);
    if (result.accepted) {
      localStorage.setItem(getVoteStorageKey(), String(result.userPosition));
      controller.setCommunityScore({
        score: result.score,
        level: result.level,
        stage: result.stage,
        upCount: result.upCount,
        downCount: result.downCount,
        upVotePoints: result.upVotePoints,
        downVotePoints: result.downVotePoints,
        isColdStart: true,
        recentEvents: [],
      });
      controller.setVotingState({
        upCount: result.upCount,
        downCount: result.downCount,
        upVotePoints: result.upVotePoints,
        downVotePoints: result.downVotePoints,
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
    controller.enterHistoryMode(date, dayData.level);
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
  if (!controller) return;
  try {
    const scoreData = await fetchScore();
    controller.setCommunityScore(scoreData);
    const savedPosition = getStoredVotePosition();
    controller.setLevel(savedPosition ?? 0);
    requestDraw(savedPosition ?? 0);

    if (renderer) {
      const videoReady = renderer.load();
      await videoReady;
      controller.setReady();

      const targetLevel = savedPosition ?? scoreData.level;
      const startLevel = 0;
      const duration = 800;
      const startTime = performance.now();
      const animateEntrance = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const level = startLevel + (targetLevel - startLevel) * eased;
        controller?.setLevel(level);
        requestDraw(level);
        if (t < 1) {
          requestAnimationFrame(animateEntrance);
        } else {
          controller?.setLevel(targetLevel);
          requestDraw(targetLevel);
        }
      };
      requestAnimationFrame(animateEntrance);
    }
  } catch {
    if (renderer) {
      renderer.load()
        .then(() => {
          controller?.setReady();
          requestDraw(15);
          controller?.setLevel(15);
        })
        .catch(() => {
          controller?.setError("加载失败，请刷新重试");
        });
    }
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
