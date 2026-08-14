import { expect, test } from "@playwright/test";

test("SSR 首帧与初始分值一致，并由 Range 视频接管 Canvas", async ({ page }) => {
  const scoreRequests: string[] = [];
  const videoStatuses: number[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/score") {
      scoreRequests.push(request.url());
    }
  });
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === "/video/liang-evolution.webm") {
      videoStatuses.push(response.status());
    }
  });

  await page.goto("/");
  const initialState = await page.locator("#liang-initial-state").textContent();
  const { score } = JSON.parse(initialState ?? "{}") as { score: number };
  const expectedPosterFrame = Math.round(Math.min(15, Math.max(-15, score))) + 15;
  const expectedVideoFrame = Math.round(
    ((Math.min(15, Math.max(-15, score)) + 15) / 30) * 240,
  );
  const expectedPoster = `/frames/frame-${String(expectedPosterFrame).padStart(2, "0")}.webp`;

  await expect(page.locator('link[rel="preload"][as="image"]')).toHaveAttribute(
    "href",
    expectedPoster,
  );
  await expect(page.locator("#strength-slider")).toBeEnabled();
  await expect(page.locator(".portrait-canvas")).toHaveAttribute(
    "data-frame",
    String(expectedVideoFrame).padStart(3, "0"),
  );
  await expect(page.locator(".ssr-poster")).toHaveCount(0);

  expect(scoreRequests).toEqual([]);
  expect(videoStatuses).toContain(206);
});

test("解码视频不改变肖像容器的正方形布局", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#strength-slider")).toBeEnabled();

  const dimensions = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".portrait-shell")!;
    const canvas = document.querySelector<HTMLCanvasElement>(".portrait-canvas")!;
    const video = document.querySelector<HTMLVideoElement>(".evolution-video")!;
    const shellRect = shell.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const videoRect = video.getBoundingClientRect();
    const videoStyle = getComputedStyle(video);

    return {
      shell: { width: shellRect.width, height: shellRect.height },
      canvas: { width: canvasRect.width, height: canvasRect.height },
      video: {
        width: videoRect.width,
        height: videoRect.height,
        position: videoStyle.position,
      },
    };
  });

  expect(dimensions.shell.height).toBeCloseTo(dimensions.shell.width, 0);
  expect(dimensions.canvas.height).toBeCloseTo(dimensions.canvas.width, 0);
  expect(dimensions.video).toEqual({
    width: 1,
    height: 1,
    position: "absolute",
  });
});

test("拖动滑杆使用视频帧更新画面，不请求等级图片", async ({ page }) => {
  const posterRequests: string[] = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (/^\/frames\/frame-\d+\.(?:png|webp)$/.test(pathname)) {
      posterRequests.push(pathname);
    }
  });

  await page.goto("/");
  const slider = page.locator("#strength-slider");
  const canvas = page.locator(".portrait-canvas");
  await expect(slider).toBeEnabled();
  posterRequests.length = 0;

  await slider.fill("-15");
  await expect(canvas).toHaveAttribute("data-frame", "000");
  const firstPixels = await canvas.evaluate((element) => {
    const canvasElement = element as HTMLCanvasElement;
    return Array.from(
      canvasElement.getContext("2d")!.getImageData(0, 0, 32, 32).data,
    );
  });
  await slider.fill("15");
  await expect(canvas).toHaveAttribute("data-frame", "240");
  await expect.poll(async () =>
    canvas.evaluate((element, previousPixels) => {
      const canvasElement = element as HTMLCanvasElement;
      const pixels = canvasElement
        .getContext("2d")!
        .getImageData(0, 0, 32, 32).data;
      return pixels.some((value, index) => value !== previousPixels[index]);
    }, firstPixels),
  ).toBe(true);

  expect(posterRequests).toEqual([]);
});
