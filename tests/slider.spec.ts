import { expect, test } from "@playwright/test";

import {
  API_ORIGIN,
  APP_PATH,
  VOTE_STORAGE_KEY,
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

test("页面包含 31 级控制、六个命名节点和三小时提示", async ({ page }) => {
  await installApiRoutes(page);
  await page.goto(APP_PATH);
  const slider = page.locator("#strength-slider");

  await expect(slider).toBeEnabled();
  await expect(slider).toHaveAttribute("min", "-15");
  await expect(slider).toHaveAttribute("max", "15");
  await expect(slider).toHaveAttribute("step", "0.01");
  await expect(page.locator(".tick")).toHaveCount(31);
  await expect(page.locator(".stage-marker")).toHaveText([
    "小难梁", "牢梁", "梁子", "梁圣", "梁神", "梁祖",
  ]);
  await expect(page.locator(".drag-hint")).toContainText("每 3 小时可修改一次");
});

test("社区分数成功加载时显示灰点并将滑杆移到社区位置", async ({ page }) => {
  const api = await installApiRoutes(page);
  await page.goto(APP_PATH);

  const ghost = page.locator(".community-ghost-thumb");
  await expect(ghost).toBeVisible();
  await expect(ghost).toHaveAttribute("aria-label", "社区当前分值 2.50");
  await expect(ghost).toHaveCSS("--community-position", "58.333333333333336");
  await expect(page.locator("#strength-slider")).toHaveValue("2.5");
  expect(api.scoreRequests).toHaveLength(1);
  expect(api.timelineRequests).toHaveLength(1);
});

test("成功投票后保存个人位置和冷却时间", async ({ page, request }) => {
  const votePosition = 9;
  await page.goto(APP_PATH);
  await expect(page.locator("#strength-slider")).toBeEnabled();

  const voteResponsePromise = page.waitForResponse((response) =>
    response.url() === "http://127.0.0.1:8787/api/vote"
    && response.request().method() === "POST",
  );
  await submitSliderScore(page, votePosition);
  const voteResponse = await voteResponsePromise;
  const logId = Number(voteResponse.headers()["x-test-log-id"]);
  expect(Number.isSafeInteger(logId)).toBe(true);
  const postLogResponse = await request.get(`${API_ORIGIN}/__test/log/${logId}`);
  expect(postLogResponse.ok()).toBe(true);
  const post = await postLogResponse.json() as {
    id: number;
    connectionId: number;
    timestamp: number;
    method: string;
    url: string;
    pathname: string;
    headers: Record<string, string>;
    body: string;
    preflightIds: number[];
  };
  expect(post).toMatchObject({
    id: logId,
    method: "POST",
    url: `${API_ORIGIN}/api/vote`,
  });
  const body = JSON.parse(post.body) as Record<string, unknown>;
  expect(body.position).toBe(votePosition);
  expect(typeof body.fingerprint).toBe("string");
  expect((body.fingerprint as string).length).toBeGreaterThanOrEqual(8);
  expect(post.preflightIds).toHaveLength(1);
  const preflightLogResponse = await request.get(
    `${API_ORIGIN}/__test/log/${post.preflightIds[0]}`,
  );
  expect(preflightLogResponse.ok()).toBe(true);
  const preflight = await preflightLogResponse.json() as typeof post;

  const stored = await page.evaluate((key) => localStorage.getItem(key), VOTE_STORAGE_KEY);
  expect(JSON.parse(stored ?? "null")).toMatchObject({ position: votePosition });
  expect(JSON.parse(stored ?? "null").nextVoteAt).toBeGreaterThan(Date.now());
  await expect(page.locator("#strength-slider")).toHaveValue(String(votePosition));
  await expect(page.locator(".community-ghost-thumb")).toHaveAttribute(
    "aria-label",
    `社区当前分值 ${votePosition.toFixed(2)}`,
  );
  await expect(page.locator(".vote-status")).toContainText("还需");
  expect(voteResponse.headers()["access-control-allow-origin"]).toBe(
    "http://127.0.0.1:5173",
  );
  expect(voteResponse.headers().vary).toBe("Origin");
  expect(preflight.connectionId).toBe(post.connectionId);
  expect(preflight.method).toBe("OPTIONS");
  expect(preflight.url).toBe(`${API_ORIGIN}/api/vote`);
  expect(preflight.headers.origin).toBe("http://127.0.0.1:5173");
  expect(preflight.headers["access-control-request-method"]).toBe("POST");
});

test("冷却期内可预览新形态，松手后恢复已投位置且不重复 POST", async ({ page }) => {
  const api = await installApiRoutes(page);
  await page.goto(APP_PATH);
  await submitSliderScore(page, 9);
  await expect.poll(() => api.voteRequests.length).toBe(1);

  await setSliderScore(page, -10);
  await expect(page.locator(".portrait-canvas")).toHaveAttribute("data-frame", "040");
  await page.locator("#strength-slider").dispatchEvent("change");

  await expect(page.locator("#strength-slider")).toHaveValue("9");
  await expect(page.locator(".portrait-canvas")).toHaveAttribute("data-frame", "192");
  await expect(page.locator(".vote-status")).toContainText("还需");
  expect(api.voteRequests).toHaveLength(1);
});

test("社区分数失败时隐藏灰点，滑杆和肖像仍可使用", async ({ page }) => {
  await installApiRoutes(page, { scoreFailure: 503 });
  await page.goto(APP_PATH);

  await expect(page.locator("#strength-slider")).toBeEnabled();
  await expect(page.locator(".community-ghost-thumb")).toBeHidden();
  await expect(page.locator(".vote-status")).toHaveText("社区数据暂时无法加载");
  await setSliderScore(page, 12);
  await expect(page.locator(".portrait-canvas")).toHaveAttribute("data-frame", "216");
});

test("投票失败时恢复原位置且不改写本地记录", async ({ page }) => {
  const original = JSON.stringify({ position: -3, nextVoteAt: 1 });
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), {
    key: VOTE_STORAGE_KEY,
    raw: original,
  });
  const api = await installApiRoutes(page, { voteFailure: 503 });
  await page.goto(APP_PATH);
  await expect(page.locator("#strength-slider")).toHaveValue("-3");

  await submitSliderScore(page, 12);
  await expect.poll(() => api.voteRequests.length).toBe(1);
  await expect(page.locator("#strength-slider")).toHaveValue("-3");
  await expect(page.locator(".vote-status")).toHaveText("提交失败，请稍后重试");
  expect(await page.evaluate((key) => localStorage.getItem(key), VOTE_STORAGE_KEY)).toBe(original);
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

test("键盘可以把滑杆移动到梁祖", async ({ page }) => {
  await installApiRoutes(page);
  await page.goto(APP_PATH);
  const slider = page.locator("#strength-slider");
  await expect(slider).toBeEnabled();
  await slider.focus();
  await slider.press("End");
  await expect(slider).toHaveValue("15");
  await expect(slider).toHaveAttribute("aria-valuetext", "梁祖，强度 +15，范围 -15 到 +15");
});

test("六个状态标签与对应大刻度对准，页面没有横向溢出", async ({ page }) => {
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
