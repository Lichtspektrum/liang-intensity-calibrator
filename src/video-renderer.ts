import { describeScore, MAX_SCORE, MIN_SCORE } from "./score-domain";

const VIDEO_FPS = 30;
const INTERPOLATED_FRAME_COUNT = 241;

export interface VideoRenderer {
  drawPoster(poster: HTMLImageElement, initialScore: number): Promise<void>;
  loadVideo(): Promise<void>;
  render(score: number): void;
  redraw(): void;
}

function mediaPath(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${base}${path.replace(/^\/+/, "")}`;
}

export function getPosterPath(score: number, baseUrl = import.meta.env.BASE_URL): string {
  const { frameIndex } = describeScore(score);
  return mediaPath(baseUrl, `frames/frame-${String(frameIndex).padStart(2, "0")}.webp`);
}

export function scoreToVideoTime(score: number, duration: number): number {
  const { score: clampedScore } = describeScore(score);
  return ((clampedScore - MIN_SCORE) / (MAX_SCORE - MIN_SCORE)) * duration;
}

export function scoreToVideoFrame(score: number): number {
  const { score: clampedScore } = describeScore(score);
  return Math.round(
    ((clampedScore - MIN_SCORE) / (MAX_SCORE - MIN_SCORE)) *
      (INTERPOLATED_FRAME_COUNT - 1),
  );
}

function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): void {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("当前浏览器不支持 Canvas 2D");
  }
  return context;
}

function drawSource(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
): void {
  resizeCanvasToDisplaySize(canvas);
  const context = getCanvasContext(canvas);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
}

function seekVideo(video: HTMLVideoElement, targetTime: number): Promise<void> {
  if (Math.abs(video.currentTime - targetTime) < 0.001) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const handleSeeked = (): void => {
      cleanup();
      resolve();
    };
    const handleError = (): void => {
      cleanup();
      reject(new Error("连续人像视频定位失败"));
    };
    const cleanup = (): void => {
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };
    video.addEventListener("seeked", handleSeeked, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.currentTime = targetTime;
  });
}

export function createVideoRenderer(
  canvas: HTMLCanvasElement,
  baseUrl = import.meta.env.BASE_URL,
): VideoRenderer {
  const video = document.createElement("video");
  video.className = "evolution-video";
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.tabIndex = -1;
  video.setAttribute("aria-hidden", "true");

  const webmSource = document.createElement("source");
  webmSource.src = mediaPath(baseUrl, "video/liang-evolution.webm");
  webmSource.type = 'video/webm; codecs="vp9"';
  const mp4Source = document.createElement("source");
  mp4Source.src = mediaPath(baseUrl, "video/liang-evolution.mp4");
  mp4Source.type = 'video/mp4; codecs="avc1.64001f"';
  video.append(webmSource, mp4Source);
  canvas.after(video);

  let displayedScore = 0;
  let videoReady = false;
  let seekFrame = 0;
  let pendingTargetTime: number | null = null;
  let seekInFlight = false;

  // 拖拽 / 状态跳转时，seek 到位后从上一帧向目标帧做短交叉淡入，
  // 使快速拖动也能看到连续平滑的形态转换（seek 间隔内不出现硬跳帧）。
  const FADE_MS = 60;
  let fadeRaf = 0;
  let fadeStartedAt = 0;
  const prevFrame = document.createElement("canvas");
  const prevFrameCtx = prevFrame.getContext("2d")!;

  const drawVideo = (): void => {
    if (videoReady && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      drawSource(canvas, video);
      canvas.dataset.frame = String(scoreToVideoFrame(displayedScore)).padStart(3, "0");
    }
  };

  const capturePrevFrame = (): void => {
    prevFrame.width = canvas.width;
    prevFrame.height = canvas.height;
    prevFrameCtx.drawImage(canvas, 0, 0);
  };

  const drawBlended = (alpha: number): void => {
    const context = getCanvasContext(canvas);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.globalAlpha = 1;
    context.drawImage(prevFrame, 0, 0, canvas.width, canvas.height);
    context.globalAlpha = alpha;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    context.globalAlpha = 1;
  };

  const showSeekedFrame = (): void => {
    if (fadeRaf) cancelAnimationFrame(fadeRaf);
    capturePrevFrame();
    fadeStartedAt = performance.now();
    const tick = (now: number): void => {
      const progress = Math.min(1, (now - fadeStartedAt) / FADE_MS);
      drawBlended(progress);
      if (progress >= 1) {
        fadeRaf = 0;
        drawVideo();
        return;
      }
      fadeRaf = requestAnimationFrame(tick);
    };
    fadeRaf = requestAnimationFrame(tick);
  };

  const scheduleLatestSeek = (): void => {
    cancelAnimationFrame(seekFrame);
    seekFrame = requestAnimationFrame(() => {
      if (
        seekInFlight ||
        pendingTargetTime === null ||
        !Number.isFinite(pendingTargetTime) ||
        video.readyState < HTMLMediaElement.HAVE_METADATA
      ) {
        return;
      }

      if (Math.abs(video.currentTime - pendingTargetTime) < 0.001) {
        pendingTargetTime = null;
        showSeekedFrame();
        return;
      }

      seekInFlight = true;
      video.currentTime = pendingTargetTime;
    });
  };

  video.addEventListener("seeked", () => {
    seekInFlight = false;
    if (
      pendingTargetTime !== null &&
      Math.abs(video.currentTime - pendingTargetTime) < 0.001
    ) {
      pendingTargetTime = null;
      showSeekedFrame();
      return;
    }
    scheduleLatestSeek();
  });

  return {
    async drawPoster(poster, initialScore) {
      if (!poster.complete) {
        await poster.decode();
      }
      displayedScore = initialScore;
      drawSource(canvas, poster);
      canvas.dataset.frame = String(describeScore(initialScore).frameIndex).padStart(2, "0");
    },
    async loadVideo() {
      await new Promise<void>((resolve, reject) => {
        video.addEventListener("loadedmetadata", () => resolve(), { once: true });
        video.addEventListener(
          "error",
          () => reject(new Error("连续人像视频加载失败")),
          { once: true },
        );
        video.load();
      });

      const targetTime = scoreToVideoTime(displayedScore, video.duration);
      const lastFrameTime = Math.max(0, video.duration - 1 / VIDEO_FPS);
      await seekVideo(video, Math.min(targetTime, lastFrameTime));
      videoReady = true;
      drawVideo();
    },
    render(score) {
      displayedScore = score;
      canvas.dataset.frame = String(scoreToVideoFrame(score)).padStart(3, "0");
      if (!videoReady || !Number.isFinite(video.duration)) return;

      const targetTime = scoreToVideoTime(score, video.duration);
      const lastFrameTime = Math.max(0, video.duration - 1 / VIDEO_FPS);
      pendingTargetTime = Math.min(targetTime, lastFrameTime);
      scheduleLatestSeek();
    },
    redraw: drawVideo,
  };
}
