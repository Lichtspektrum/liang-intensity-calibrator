import { expect, test } from "@playwright/test";

const milestones = [
  [-15, "小难梁"],
  [-9, "牢梁"],
  [-3, "梁子"],
  [3, "梁圣"],
  [9, "梁神"],
  [15, "梁祖"],
] as const;

async function setSliderScore(page: import("@playwright/test").Page, score: number) {
  await page.locator("#strength-slider").evaluate((element, value) => {
    const slider = element as HTMLInputElement;
    slider.value = String(value);
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  }, score);
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/score", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        score: 0,
        stage: "梁子",
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0,
        positivePoints: 0,
        negativePoints: 0,
        isColdStart: true,
        recentEvents: [],
      }),
    }),
  );
  await page.goto("/");
  await expect(page.locator("#strength-slider")).toBeEnabled();
});

test("页面包含完整的 31 级控制与六个命名节点", async ({ page }) => {
  const slider = page.locator("#strength-slider");

  await expect(slider).toHaveAttribute("min", "-15");
  await expect(slider).toHaveAttribute("max", "15");
  await expect(slider).toHaveAttribute("step", "0.01");
  await expect(page.locator(".tick")).toHaveCount(31);
  await expect(page.locator(".stage-marker")).toHaveText([
    "小难梁",
    "牢梁",
    "梁子",
    "梁圣",
    "梁神",
    "梁祖",
  ]);
});

test("六个里程碑同步更新文字、分值与 Canvas 描述", async ({ page }) => {
  for (const [score, stage] of milestones) {
    await setSliderScore(page, score);
    await expect(page.locator(".stage-name")).toHaveText(stage);
    await expect(page.locator(".level-output")).toHaveText(
      `${score > 0 ? "+" : "-"}${String(Math.abs(score)).padStart(2, "0")}`,
    );
    await expect(page.locator(".portrait-canvas")).toHaveAttribute(
      "aria-label",
      `当前形态：${stage}`,
    );
  }
});

test("键盘可以把滑杆移动到梁祖", async ({ page }) => {
  const slider = page.locator("#strength-slider");
  await slider.focus();
  await slider.press("End");

  await expect(slider).toHaveValue("15");
  await expect(page.locator(".stage-name")).toHaveText("梁祖");
  await expect(slider).toHaveAttribute(
    "aria-valuetext",
    "梁祖，强度 +15，范围 -15 到 +15",
  );
});

test("Canvas 已完成实际绘制", async ({ page }) => {
  const dimensions = await page.locator(".portrait-canvas").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    return { width: canvas.width, height: canvas.height };
  });

  expect(dimensions.width).toBeGreaterThan(300);
  expect(dimensions.height).toBeGreaterThan(300);
});

test("连续滑动位置映射到 241 帧视频中的对应插值帧", async ({ page }) => {
  const canvas = page.locator(".portrait-canvas");

  for (const score of [-15, -7.5, 0, 4.5, 15]) {
    await setSliderScore(page, score);
    await expect(canvas).toHaveAttribute(
      "data-frame",
      String(Math.round(((score + 15) / 30) * 240)).padStart(3, "0"),
    );
  }
});

test("滑动位置会绘制对应等级图片", async ({ page }) => {
  await setSliderScore(page, 3.35);
  await expect(page.locator("#strength-slider")).toHaveValue("3.35");
  await expect(page.locator(".portrait-canvas")).toHaveAttribute("data-frame", "147");
});

test("六个状态标签与对应的大刻度对准", async ({ page }) => {
  const alignments = await page.locator(".stage-marker").evaluateAll((markers) =>
    markers.map((marker, index) => {
      const markerRect = marker.getBoundingClientRect();
      const tickRect = document
        .querySelector<HTMLElement>(`.tick[data-score="${-15 + index * 6}"]`)!
        .getBoundingClientRect();

      return Math.abs(
        markerRect.left + markerRect.width / 2 - (tickRect.left + tickRect.width / 2),
      );
    }),
  );

  for (const offset of alignments) {
    expect(offset).toBeLessThanOrEqual(1);
  }
});

test("页面在当前视口没有横向溢出", async ({ page }, testInfo) => {
  await setSliderScore(page, 15);

  const viewport = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
  await page.screenshot({
    path: testInfo.outputPath("liangzu.png"),
    fullPage: true,
  });
});
