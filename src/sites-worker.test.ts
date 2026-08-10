import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";
// @ts-expect-error generated worker is plain JavaScript
import worker from "../dist/server/index.js";

describe("public static worker", () => {
  it("构建结果声明静态资源绑定", async () => {
    const config = JSON.parse(
      await readFile(new URL("../dist/wrangler.json", import.meta.url), "utf8"),
    );

    expect(config.assets).toMatchObject({
      binding: "ASSETS",
      directory: "./client",
      not_found_handling: "single-page-application",
    });
    expect(config.compatibility_date).toBe("2026-08-08");
  });

  it("将请求交给静态资源绑定", async () => {
    const requestedPaths: string[] = [];
    const response = await worker.fetch(new Request("https://example.com/"), {
      ASSETS: {
        fetch(request: Request) {
          requestedPaths.push(new URL(request.url).pathname);
          return Promise.resolve(new Response("ok"));
        },
      },
    });

    expect(response.status).toBe(200);
    expect(requestedPaths).toEqual(["/"]);
  });
});
