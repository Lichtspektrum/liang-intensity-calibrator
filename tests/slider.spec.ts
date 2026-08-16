import { expect, test } from "@playwright/test";

import {
  APP_PATH,
  MANUAL_STORAGE_KEY,
  installApiRoutes,
  setSliderScore,
  submitSliderScore,
} from "./api-fixture";

const milestones = [
  [-15, "小难梁"],
  [-9, "牢梁"],
  [-3, "梁子"],
  [3, "梁圣"],
  [9, "梁神"],
  [15, "梁祖"],
] as const;

test("手动模式显示 31 级变阻器与社区投票状态行", async ({ page }) => {
  await installApiRoutes(page);
  await page.goto(APP_PATH);

  const slider = page.locator("#strength-slider");
  await expect(slider).toBeEnabled();
  await expect(slider).toHaveAttribute("min", "-15");
  await expect(slider).toHaveAttribute("max", "15");
  await expect(slider).toHaveAttribute("step", "0.01");
  await expect(page.locator(".tick")).toHaveCount(31);
  await expect(page.locator(".stage-marker")).toHaveText(milestones.map(([, stage]) => stage));
  await expect(page.locator(".rheostat-chassis")).toBeVisible();
  await expect(page.locator(".drag-hint")).toContainText("松开即提交");
  await expect(page.locator(".vote-status")).toContainText("你的投票");
  await expect(page.locator(".vote-status")).toContainText(/每 3 小时|社区平均/u);
});

test("真实鼠标拖动可连续改变手动强度并提交社区投票", async ({ page }) => {
  const api = await installApiRoutes(page);
  await page.goto(APP_PATH);

  const slider = page.locator("#strength-slider");
  const box = await slider.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.82, box!.y + box!.height * 0.5, { steps: 12 });
  await page.mouse.up();

  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(8);
  const stored = await page.evaluate((key) => localStorage.getItem(key), MANUAL_STORAGE_KEY);
  expect(JSON.parse(stored ?? "null").position).toBeGreaterThan(8);
  expect(api.voteRequests).toHaveLength(1);
});

test("手动位置可随时修改，刷新后恢复最新位置", async ({ page }) => {
  const api = await installApiRoutes(page);
  await page.goto(APP_PATH);
  await submitSliderScore(page, 9);
  await submitSliderScore(page, -10);

  await expect(page.locator("#strength-slider")).toHaveValue("-10");
  await page.reload();
  await expect(page.locator("#strength-slider")).toHaveValue("-10");
  expect(api.voteRequests).toHaveLength(2);
});

test("在线基线不可用时仍可手动拖动", async ({ page }) => {
  await installApiRoutes(page, { scoreFailure: 503 });
  await page.goto(APP_PATH);

  await expect(page.locator("#strength-slider")).toBeEnabled();
  await expect(page.locator(".calibration-status")).toHaveText("拖动滑片校准并参与社区投票，位置与投票都会记住");
  await expect(page.locator(".vote-status")).toContainText("社区数据暂时无法加载");
  await setSliderScore(page, 12);
  await expect(page.locator(".portrait-canvas")).toHaveAttribute("data-frame", "216");
});

test("六个里程碑同步更新文字、分值与 Canvas 描述", async ({ page }) => {
  await installApiRoutes(page);
  await page.goto(APP_PATH);
  for (const [score, stage] of milestones) {
    await setSliderScore(page, score);
    await expect(page.locator(".stage-name")).toHaveText(stage);
    await expect(page.locator(".level-output")).toHaveText(
      `${score > 0 ? "+" : "-"}${String(Math.abs(score)).padStart(2, "0")}`,
    );
    await expect(page.locator(".portrait-canvas")).toHaveAttribute("aria-label", `当前形态：${stage}`);
  }
});

test("键盘可以把滑片移动到梁祖", async ({ page }) => {
  await installApiRoutes(page);
  await page.goto(APP_PATH);
  const slider = page.locator("#strength-slider");
  await slider.focus();
  await slider.press("End");
  await expect(slider).toHaveValue("15");
  await expect(slider).toHaveAttribute("aria-valuetext", "梁祖，强度 +15，范围 -15 到 +15");
});

test("状态标签与大刻度对齐且页面没有横向溢出", async ({ page }) => {
  await installApiRoutes(page);
  await page.goto(APP_PATH);
  const alignments = await page.locator(".stage-marker").evaluateAll((markers) =>
    markers.map((marker, index) => {
      const markerRect = marker.getBoundingClientRect();
      const tickRect = document
        .querySelector<HTMLElement>(`.tick[data-score="${-15 + index * 6}"]`)!
        .getBoundingClientRect();
      return Math.abs(markerRect.left + markerRect.width / 2 - (tickRect.left + tickRect.width / 2));
    }),
  );
  for (const offset of alignments) expect(offset).toBeLessThanOrEqual(1);

  const viewport = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
});
