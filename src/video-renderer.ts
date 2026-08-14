import { describeScore, MAX_SCORE, MIN_SCORE } from "./score-domain";

const VIDEO_FPS = 30;
const INTERPOLATED_FRAME_COUNT = 241;

export interface VideoRenderer {
  drawPoster(poster: HTMLImageElement, initialScore: number): Promise<void>;
  loadVideo(): Promise<void>;
  render(score: number): void;
  redraw(): void;
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

export function createVideoRenderer(canvas: HTMLCanvasElement): VideoRenderer {
  const video = document.createElement("video");
  video.className = "evolution-video";
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.tabIndex = -1;
  video.setAttribute("aria-hidden", "true");

  const webmSource = document.createElement("source");
  webmSource.src = "/video/liang-evolution.webm";
  webmSource.type = 'video/webm; codecs="vp9"';
  const mp4Source = document.createElement("source");
  mp4Source.src = "/video/liang-evolution.mp4";
  mp4Source.type = 'video/mp4; codecs="avc1.64001f"';
  video.append(webmSource, mp4Source);
  canvas.after(video);

  let displayedScore = 0;
  let videoReady = false;
  let seekFrame = 0;
  let pendingTargetTime: number | null = null;
  let seekInFlight = false;

  const drawVideo = (): void => {
    if (videoReady && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      drawSource(canvas, video);
      canvas.dataset.frame = String(scoreToVideoFrame(displayedScore)).padStart(3, "0");
    }
  };

  const drawDecodedFrame = (): void => {
    drawVideo();
    if (typeof video.requestVideoFrameCallback === "function") {
      video.requestVideoFrameCallback(() => {
        if (!seekInFlight && pendingTargetTime === null) {
          drawVideo();
        }
      });
    }
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
        drawDecodedFrame();
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
      drawDecodedFrame();
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
