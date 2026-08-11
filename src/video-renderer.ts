import { clampPosition, MAX_LEVEL } from "./progression";

const VIDEO_FPS = 30;
const INTERPOLATION_FACTOR = 8;

export interface EvolutionVideoRenderer {
  readonly video: HTMLVideoElement;
  load(): Promise<void>;
  render(position: number): void;
  redraw(): void;
}

export function positionToVideoTime(position: number, duration: number): number {
  return (clampPosition(position) / MAX_LEVEL) * duration;
}

function videoAssetPath(filename: string): string {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}video/${filename}`;
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

export function createEvolutionVideoRenderer(
  canvas: HTMLCanvasElement,
): EvolutionVideoRenderer {
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;

  const webmSource = document.createElement("source");
  webmSource.src = videoAssetPath("liang-evolution.webm");
  webmSource.type = 'video/webm; codecs="vp9"';

  const mp4Source = document.createElement("source");
  mp4Source.src = videoAssetPath("liang-evolution.mp4");
  mp4Source.type = 'video/mp4; codecs="avc1.64001f"';

  video.append(webmSource, mp4Source);

  let requestedTime = 0;
  let seekFrame = 0;

  const drawNow = (): void => {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    resizeCanvasToDisplaySize(canvas);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("当前浏览器不支持 Canvas 2D");
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
  };

  const drawDecodedFrame = (): void => {
    drawNow();
    if (typeof video.requestVideoFrameCallback === "function") {
      video.requestVideoFrameCallback(() => drawNow());
    }
  };

  video.addEventListener("seeked", drawDecodedFrame);

  const render = (position: number): void => {
    const clampedPosition = clampPosition(position);
    requestedTime = positionToVideoTime(clampedPosition, video.duration || 0);
    canvas.dataset.frame = String(
      Math.round(clampedPosition * INTERPOLATION_FACTOR),
    ).padStart(3, "0");

    cancelAnimationFrame(seekFrame);
    seekFrame = requestAnimationFrame(() => {
      if (!Number.isFinite(requestedTime) || video.readyState < 1) {
        return;
      }

      const lastFrameTime = Math.max(0, video.duration - 1 / VIDEO_FPS);
      video.currentTime = Math.min(requestedTime, lastFrameTime);
    });
  };

  return {
    video,
    load() {
      return new Promise((resolve, reject) => {
        const handleReady = (): void => {
          drawNow();
          resolve();
        };
        const handleError = (): void => {
          reject(new Error("连续人像视频加载失败"));
        };

        video.addEventListener("loadeddata", handleReady, { once: true });
        video.addEventListener("error", handleError, { once: true });
        video.load();
      });
    },
    render,
    redraw: drawNow,
  };
}
