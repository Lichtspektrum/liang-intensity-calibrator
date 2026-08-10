import { expect, test } from "@playwright/test";

const milestones = [
  [0, "小难梁"],
  [6, "牢梁"],
  [12, "梁子"],
  [18, "梁圣"],
  [24, "梁神"],
  [30, "梁祖"],
] as const;

async function setSliderLevel(page: import("@playwright/test").Page, level: number) {
  await page.locator("#strength-slider").evaluate((element, value) => {
    const slider = element as HTMLInputElement;
    slider.value = String(value);
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  }, level);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#strength-slider")).toBeEnabled();
});

test("页面包含完整的 31 级控制与六个命名节点", async ({ page }) => {
  const slider = page.locator("#strength-slider");

  await expect(slider).toHaveAttribute("min", "0");
  await expect(slider).toHaveAttribute("max", "30");
  await expect(slider).toHaveAttribute("step", "1");
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

test("六个里程碑同步更新文字、等级与 Canvas 描述", async ({ page }) => {
  for (const [level, stage] of milestones) {
    await setSliderLevel(page, level);
    await expect(page.locator(".stage-name")).toHaveText(stage);
    await expect(page.locator(".level-output")).toHaveText(
      `${String(level).padStart(2, "0")} / 30`,
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

  await expect(slider).toHaveValue("30");
  await expect(page.locator(".stage-name")).toHaveText("梁祖");
  await expect(slider).toHaveAttribute("aria-valuetext", "梁祖，30 级，共 30 级");
});

test("Canvas 已完成实际绘制", async ({ page }) => {
  const dimensions = await page.locator(".portrait-canvas").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    return { width: canvas.width, height: canvas.height };
  });

  expect(dimensions.width).toBeGreaterThan(300);
  expect(dimensions.height).toBeGreaterThan(300);
});

test("31 个等级分别绘制对应的独立图片", async ({ page }) => {
  const canvas = page.locator(".portrait-canvas");

  for (let level = 0; level <= 30; level += 1) {
    await setSliderLevel(page, level);
    await expect(canvas).toHaveAttribute("data-frame", String(level).padStart(2, "0"));
  }
});

test("六个状态标签与对应的大刻度对准", async ({ page }) => {
  const alignments = await page.locator(".stage-marker").evaluateAll((markers) =>
    markers.map((marker, index) => {
      const markerRect = marker.getBoundingClientRect();
      const tickRect = document
        .querySelector<HTMLElement>(`.tick[data-level="${index * 6}"]`)!
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
  await setSliderLevel(page, 30);

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
