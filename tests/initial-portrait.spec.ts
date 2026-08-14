import { expect, test } from "@playwright/test";

import { API_ORIGIN, APP_PATH, installApiRoutes, setSliderScore } from "./api-fixture";

test("初始画面在在线基线返回后交给连续视频", async ({ page }) => {
  const posterRequests: string[] = [];
  const videoResponses: Array<{ pathname: string; status: number }> = [];
  const api = await installApiRoutes(page);
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (/\/frames\/frame-15\.webp$/u.test(pathname)) posterRequests.push(pathname);
  });
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (/\/video\/liang-evolution\.(?:webm|mp4)$/u.test(pathname)) {
      videoResponses.push({ pathname, status: response.status() });
    }
  });

  await page.goto(APP_PATH);
  await expect(page.locator("#strength-slider")).toBeEnabled();
  await expect(page.locator(".portrait-canvas")).toHaveAttribute("data-frame", "140");
  await expect(page.locator(".ssr-poster")).toHaveCount(0);
  expect(posterRequests).toContain(`${APP_PATH}frames/frame-15.webp`);
  expect(api.scoreRequests).toHaveLength(1);
  expect(api.scoreRequests[0].url()).toBe(`${API_ORIGIN}/api/score`);
  expect(videoResponses.some(({ pathname, status }) =>
    pathname.startsWith(`${APP_PATH}video/`) && status === 206,
  )).toBe(true);
});

test("解码视频不改变肖像容器的正方形布局", async ({ page }) => {
  await installApiRoutes(page);
  await page.goto(APP_PATH);
  const dimensions = await page.evaluate(() => {
    const shellRect = document.querySelector<HTMLElement>(".portrait-shell")!.getBoundingClientRect();
    const canvasRect = document.querySelector<HTMLCanvasElement>(".portrait-canvas")!.getBoundingClientRect();
    const video = document.querySelector<HTMLVideoElement>(".evolution-video")!;
    const videoRect = video.getBoundingClientRect();
    return {
      shell: { width: shellRect.width, height: shellRect.height },
      canvas: { width: canvasRect.width, height: canvasRect.height },
      video: { width: videoRect.width, height: videoRect.height, position: getComputedStyle(video).position },
    };
  });
  expect(dimensions.shell.height).toBeCloseTo(dimensions.shell.width, 0);
  expect(dimensions.canvas.height).toBeCloseTo(dimensions.canvas.width, 0);
  expect(dimensions.video).toEqual({ width: 1, height: 1, position: "absolute" });
});

test("拖动滑片使用视频帧更新画面，不请求等级图片", async ({ page }) => {
  const posterRequests: string[] = [];
  await installApiRoutes(page);
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (/\/frames\/frame-\d+\.(?:png|webp)$/u.test(pathname)) posterRequests.push(pathname);
  });
  await page.goto(APP_PATH);
  const canvas = page.locator(".portrait-canvas");
  posterRequests.length = 0;
  await setSliderScore(page, -15);
  await expect(canvas).toHaveAttribute("data-frame", "000");
  await setSliderScore(page, 15);
  await expect(canvas).toHaveAttribute("data-frame", "240");
  expect(posterRequests).toEqual([]);
});
