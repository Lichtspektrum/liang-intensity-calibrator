import { describe, expect, it } from "vitest";
// @ts-expect-error generated worker is plain JavaScript
import worker from "../dist/server/index.js";

describe("public static worker", () => {
  it("在根路径回退到 index.html", async () => {
    const requestedPaths: string[] = [];
    const response = await worker.fetch(new Request("https://example.com/"), {
      ASSETS: {
        fetch(request: Request) {
          requestedPaths.push(new URL(request.url).pathname);
          return Promise.resolve(
            new Response("ok", {
              status: requestedPaths.at(-1) === "/index.html" ? 200 : 404,
            }),
          );
        },
      },
    });

    expect(response.status).toBe(200);
    expect(requestedPaths).toEqual(["/", "/index.html"]);
  });
});
