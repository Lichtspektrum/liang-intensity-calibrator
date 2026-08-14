import { expect, test } from "@playwright/test";
import { APP_PATH, installApiRoutes } from "./api-fixture";

test("新闻模式自动校准并在独立滚动栏显示来源", async ({ page }, testInfo) => {
  const api = await installApiRoutes(page);
  await page.goto(APP_PATH);
  await page.getByRole("button", { name: "今日 AI 新闻" }).click();

  await expect(page.locator(".news-headline")).toHaveText("开放与效率成为今天的主信号");
  await expect(page.locator(".level-output")).toHaveText("+09");
  await expect(page.locator(".news-progress-percent")).toHaveText("100%");
  await expect(page.locator(".news-markdown h3")).toContainText("Open model release");
  await expect(page.locator(".rheostat-chassis")).toBeVisible();
  await expect(page.locator(".calibration-status")).toHaveText("由今日 AI 新闻自动校准，变阻器将跟随分析结果");
  await expect(page.locator("#strength-slider")).toBeDisabled();
  expect(api.newsRequests).toHaveLength(1);
  expect(api.voteRequests).toHaveLength(0);

  if (testInfo.project.name === "desktop-chromium") {
    const layout = await page.evaluate(() => {
      const portrait = document.querySelector<HTMLElement>(".portrait-shell")!.getBoundingClientRect();
      const panel = document.querySelector<HTMLElement>(".news-panel")!;
      const panelRect = panel.getBoundingClientRect();
      return {
        portraitCenter: portrait.left + portrait.width / 2,
        panelLeft: panelRect.left,
        viewportWidth: innerWidth,
        pageScrollHeight: document.documentElement.scrollHeight,
        viewportHeight: innerHeight,
        panelOverflowY: getComputedStyle(panel).overflowY,
      };
    });
    expect(layout.portraitCenter).toBeLessThan(layout.viewportWidth / 2);
    expect(layout.panelLeft).toBeGreaterThanOrEqual(layout.viewportWidth / 2 - 2);
    expect(layout.pageScrollHeight).toBeLessThanOrEqual(layout.viewportHeight + 1);
    expect(layout.panelOverflowY).toBe("auto");
  }
});

test("梁式对话连续保留上下文，输出区独立滚动", async ({ page }, testInfo) => {
  const api = await installApiRoutes(page);
  await page.goto(APP_PATH);
  await page.getByRole("button", { name: "梁式对话" }).click();

  await page.locator("#chat-input").fill("我们要不要先扩产品线？");
  await page.getByRole("button", { name: "校准并回答" }).click();
  await expect(page.locator(".chat-turn--assistant").last()).toContainText("真正的技术瓶颈");
  await page.locator("#chat-input").fill("那下一步具体看什么？");
  await page.getByRole("button", { name: "校准并回答" }).click();
  await expect(page.locator(".chat-turn--user")).toHaveCount(2);
  await expect(page.locator(".chat-turn--assistant")).toHaveCount(2);

  expect(api.chatRequests).toHaveLength(2);
  const firstBody = api.chatRequests[0].postDataJSON() as {
    message: string;
    conversationId: string;
  };
  const secondBody = api.chatRequests[1].postDataJSON() as {
    message: string;
    conversationId: string;
  };
  expect(firstBody.message).toBe("我们要不要先扩产品线？");
  expect(firstBody.conversationId).toMatch(/^[0-9a-f-]{36}$/u);
  expect(secondBody.message).toBe("那下一步具体看什么？");
  expect(secondBody.conversationId).toBe(firstBody.conversationId);
  await expect(page.locator(".chat-turn--assistant").last().locator(".chat-turn-score"))
    .toHaveText("梁圣 · +6");
  await expect(page.locator(".calibration-status")).toHaveText("由当前对话自动校准，变阻器将平滑移动到分析结果");
  await expect(page.locator("#strength-slider")).toBeDisabled();
  expect(api.voteRequests).toHaveLength(0);

  if (testInfo.project.name === "desktop-chromium") {
    const layout = await page.evaluate(() => {
      const portrait = document.querySelector<HTMLElement>(".portrait-shell")!.getBoundingClientRect();
      const panel = document.querySelector<HTMLElement>(".chat-panel")!.getBoundingClientRect();
      const thread = document.querySelector<HTMLElement>(".chat-thread")!;
      return {
        portraitCenter: portrait.left + portrait.width / 2,
        panelLeft: panel.left,
        viewportWidth: innerWidth,
        pageScrollHeight: document.documentElement.scrollHeight,
        viewportHeight: innerHeight,
        threadOverflowY: getComputedStyle(thread).overflowY,
      };
    });
    expect(layout.portraitCenter).toBeLessThan(layout.viewportWidth / 2);
    expect(layout.panelLeft).toBeGreaterThanOrEqual(layout.viewportWidth / 2 - 2);
    expect(layout.pageScrollHeight).toBeLessThanOrEqual(layout.viewportHeight + 1);
    expect(layout.threadOverflowY).toBe("auto");
  }
});

test("从自动模式回到手动模式时恢复本机位置", async ({ page }) => {
  await installApiRoutes(page);
  await page.goto(APP_PATH);
  await page.getByRole("button", { name: "今日 AI 新闻" }).click();
  await expect(page.locator("#strength-slider")).toHaveValue("9");
  await page.getByRole("button", { name: "手动" }).click();
  await expect(page.locator("#strength-slider")).toHaveValue("2.5");
  await expect(page.locator("#strength-slider")).toBeEnabled();
});

test("新闻模式位置在切回时保持，不丢失给手动模式", async ({ page }) => {
  await installApiRoutes(page);
  await page.goto(APP_PATH);
  await page.getByRole("button", { name: "今日 AI 新闻" }).click();
  await expect(page.locator("#strength-slider")).toHaveValue("9");
  await page.getByRole("button", { name: "手动" }).click();
  await expect(page.locator("#strength-slider")).toHaveValue("2.5");
  await page.getByRole("button", { name: "今日 AI 新闻" }).click();
  await expect(page.locator("#strength-slider")).toHaveValue("9");
  await expect(page.locator("#strength-slider")).toBeDisabled();
});

test("对话模式位置在切回时保持，不丢失给手动模式", async ({ page }) => {
  await installApiRoutes(page);
  await page.goto(APP_PATH);
  await page.getByRole("button", { name: "梁式对话" }).click();
  await page.locator("#chat-input").fill("我们要不要先扩产品线？");
  await page.getByRole("button", { name: "校准并回答" }).click();
  await expect(page.locator(".chat-turn--assistant").last()).toContainText("真正的技术瓶颈");
  await expect(page.locator("#strength-slider")).toHaveValue("6");
  await page.getByRole("button", { name: "手动" }).click();
  await expect(page.locator("#strength-slider")).toHaveValue("2.5");
  await page.getByRole("button", { name: "梁式对话" }).click();
  await expect(page.locator("#strength-slider")).toHaveValue("6");
  await expect(page.locator("#strength-slider")).toBeDisabled();
});
