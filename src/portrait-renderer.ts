import { getProgression } from "./progression";

export function getPortraitPath(baseUrl: string, level: number): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${base}frames/frame-${String(level).padStart(2, "0")}.png`;
}

export const PORTRAIT_PATHS = Array.from(
  { length: 31 },
  (_, level) => getPortraitPath(import.meta.env.BASE_URL, level),
);

export function getFrameIndex(level: number): number {
  return getProgression(level).level;
}

export async function preloadPortraits(
  onProgress?: (loaded: number, total: number) => void,
): Promise<HTMLImageElement[]> {
  let loaded = 0;

  return Promise.all(
    PORTRAIT_PATHS.map(async (path) => {
      const image = new Image();
      image.src = path;
      await image.decode();
      loaded += 1;
      onProgress?.(loaded, PORTRAIT_PATHS.length);
      return image;
    }),
  );
}

export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): boolean {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);

  if (canvas.width === width && canvas.height === height) {
    return false;
  }

  canvas.width = width;
  canvas.height = height;
  return true;
}

export function drawPortrait(
  canvas: HTMLCanvasElement,
  images: readonly HTMLImageElement[],
  level: number,
): void {
  if (images.length !== PORTRAIT_PATHS.length) {
    throw new Error("人物图片数量不完整");
  }

  resizeCanvasToDisplaySize(canvas);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("当前浏览器不支持 Canvas 2D");
  }

  const frameIndex = getFrameIndex(level);

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(images[frameIndex], 0, 0, canvas.width, canvas.height);
  canvas.dataset.frame = String(frameIndex).padStart(2, "0");
}
