import { describe, expect, it } from "vitest";

import { handleMediaRequest } from "./media-response";
import type { Env } from "./api/shared";

function createObject(bytes: Uint8Array): R2ObjectBody {
  const buffer = Uint8Array.from(bytes).buffer;
  return {
    key: "video/liang-evolution.webm",
    size: bytes.byteLength,
    etag: "etag",
    httpEtag: '"etag"',
    uploaded: new Date(0),
    body: new Blob([buffer]).stream(),
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(buffer),
    text: () => Promise.resolve(""),
    json: <T>() => Promise.resolve({} as T),
    blob: () => Promise.resolve(new Blob([buffer])),
    writeHttpMetadata(headers) {
      headers.set("Content-Type", "video/webm");
    },
  };
}

function createEnv(bytes: Uint8Array): Env {
  const metadata = createObject(bytes);
  return {
    ASSETS: { fetch: () => Promise.resolve(new Response()) },
    DB: {} as D1Database,
    KV: {} as KVNamespace,
    MEDIA: {
      head: () => Promise.resolve(metadata),
      get: (_key, options) => {
        if (!options?.range || options.range instanceof Headers) {
          return Promise.resolve(createObject(bytes));
        }
        const range = options.range;
        const offset = "offset" in range ? range.offset ?? 0 : 0;
        const length =
          "length" in range && range.length !== undefined
            ? range.length
            : bytes.byteLength - offset;
        return Promise.resolve(createObject(bytes.slice(offset, offset + length)));
      },
    },
  };
}

describe("handleMediaRequest", () => {
  const bytes = new TextEncoder().encode("0123456789");

  it("返回规范的单段 206 响应", async () => {
    const response = await handleMediaRequest(
      new Request("https://example.com/video/liang-evolution.webm", {
        headers: { Range: "bytes=2-5" },
      }),
      createEnv(bytes),
      "video/liang-evolution.webm",
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 2-5/10");
    expect(response.headers.get("Content-Length")).toBe("4");
    expect(await response.text()).toBe("2345");
  });

  it("支持 suffix range", async () => {
    const response = await handleMediaRequest(
      new Request("https://example.com/video/liang-evolution.webm", {
        headers: { Range: "bytes=-3" },
      }),
      createEnv(bytes),
      "video/liang-evolution.webm",
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 7-9/10");
    expect(await response.text()).toBe("789");
  });

  it("拒绝多段或越界 range", async () => {
    const response = await handleMediaRequest(
      new Request("https://example.com/video/liang-evolution.webm", {
        headers: { Range: "bytes=20-30" },
      }),
      createEnv(bytes),
      "video/liang-evolution.webm",
    );

    expect(response.status).toBe(416);
    expect(response.headers.get("Content-Range")).toBe("bytes */10");
  });
});
