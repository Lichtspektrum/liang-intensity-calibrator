import { expect, test } from "@playwright/test";

const scoreAtLiangsheng = {
  score: 7.5,
  stage: "梁圣",
  positiveCount: 0,
  negativeCount: 0,
  neutralCount: 0,
  positivePoints: 0,
  negativePoints: 0,
  isColdStart: true,
  recentEvents: [],
};

test("初始分值为梁圣时，就绪的 Canvas 显示对应等级图片", async ({ page }) => {
  await page.route("**/api/score", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(scoreAtLiangsheng),
    }),
  );

  await page.goto("/");
  await expect(page.locator(".stage-name")).toHaveText("梁圣");
  await expect(page.locator("#strength-slider")).toBeEnabled();
  await expect(page.locator(".portrait-canvas")).toHaveAttribute(
    "data-frame",
    "23",
  );

  const frameDistances = await page.locator(".portrait-canvas").evaluate(
    async (element) => {
      const canvas = element as HTMLCanvasElement;
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      const rendered = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;

      const distanceTo = async (source: string): Promise<number> => {
        const image = new Image();
        image.src = source;
        await image.decode();

        const reference = document.createElement("canvas");
        reference.width = canvas.width;
        reference.height = canvas.height;
        reference.getContext("2d")!.drawImage(
          image,
          0,
          0,
          reference.width,
          reference.height,
        );
        const pixels = reference
          .getContext("2d", { willReadFrequently: true })!
          .getImageData(0, 0, reference.width, reference.height).data;

        let difference = 0;
        for (let index = 0; index < rendered.length; index += 16) {
          difference += Math.abs(rendered[index] - pixels[index]);
        }
        return difference;
      };

      return {
        initial: await distanceTo("/frames/frame-00.png"),
        liangsheng: await distanceTo("/frames/frame-23.png"),
      };
    },
  );

  expect(frameDistances.liangsheng).toBeLessThan(frameDistances.initial);
});
