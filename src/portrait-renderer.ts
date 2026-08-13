import { describeScore, SCORE_COUNT } from "./score-domain";

export const PORTRAIT_PATHS = Array.from(
  { length: SCORE_COUNT },
  (_, frameIndex) => `/frames/frame-${String(frameIndex).padStart(2, "0")}.png`,
);

export interface PortraitRenderer {
  render(position: number): Promise<void>;
  redraw(): void;
}

export function getFrameIndex(position: number): number {
  return describeScore(position).frameIndex;
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

export function createPortraitRenderer(
  canvas: HTMLCanvasElement,
): PortraitRenderer {
  const images = new Map<number, Promise<HTMLImageElement>>();
  let requestedFrame = 0;
  let displayedImage: HTMLImageElement | null = null;
  let displayedFrame = 0;

  const loadFrame = (frame: number): Promise<HTMLImageElement> => {
    const cached = images.get(frame);
    if (cached) {
      return cached;
    }

    const loading = (async () => {
      const image = new Image();
      image.src = PORTRAIT_PATHS[frame];
      await image.decode();
      return image;
    })();
    images.set(frame, loading);
    return loading;
  };

  const draw = (image: HTMLImageElement, frame: number): void => {
    resizeCanvasToDisplaySize(canvas);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("当前浏览器不支持 Canvas 2D");
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.dataset.frame = String(frame).padStart(2, "0");
  };

  return {
    async render(position) {
      const frame = getFrameIndex(position);
      requestedFrame = frame;
      const image = await loadFrame(frame);
      if (requestedFrame !== frame) {
        return;
      }

      displayedImage = image;
      displayedFrame = frame;
      draw(image, frame);
    },
    redraw() {
      if (displayedImage) {
        draw(displayedImage, displayedFrame);
      }
    },
  };
}
