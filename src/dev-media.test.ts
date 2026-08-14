import { readlinkSync, readdirSync } from "node:fs";
import { get } from "node:http";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { fileURLToPath } from "node:url";

const servers: ViteDevServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function startDevelopmentServer(): Promise<string> {
  const server = await createServer({
    configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0 },
  });
  servers.push(server);
  await server.listen();

  const address = server.httpServer?.address();
  if (!address || typeof address === "string") {
    throw new Error("Vite development server did not expose a TCP port");
  }

  return `http://127.0.0.1:${address.port}`;
}

function openMediaDescriptorCount(): number {
  if (process.platform === "linux") {
    return readdirSync("/proc/self/fd").filter((descriptor) => {
      try {
        return readlinkSync(`/proc/self/fd/${descriptor}`).includes("/media/liang-evolution.");
      } catch {
        return false;
      }
    }).length;
  }

  return execFileSync("lsof", ["-a", "-p", String(process.pid), "-Fn"], { encoding: "utf8" })
    .split("\n")
    .filter((line) => line.startsWith("n") && line.includes("/media/liang-evolution."))
    .length;
}

describe("Vite development media", () => {
  it.each([
    ["webm", "video/webm"],
    ["mp4", "video/mp4"],
  ])("serves %s byte ranges from the source media directory", async (extension, contentType) => {
    const origin = await startDevelopmentServer();
    const response = await fetch(
      `${origin}/video/liang-evolution.${extension}`,
      { headers: { Range: "bytes=0-1023" } },
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe(contentType);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-range")).toMatch(/^bytes 0-1023\/\d+$/u);
    expect(response.headers.get("content-length")).toBe("1024");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.arrayBuffer()).byteLength).toBe(1024);
  });

  it("supports full, HEAD, open, suffix, invalid, and query-string requests", async () => {
    const origin = await startDevelopmentServer();
    const url = `${origin}/video/liang-evolution.webm`;

    const head = await fetch(url, { method: "HEAD" });
    const size = Number(head.headers.get("content-length"));
    expect(head.status).toBe(200);
    expect(head.headers.get("content-type")).toBe("video/webm");
    expect((await head.arrayBuffer()).byteLength).toBe(0);
    expect(size).toBeGreaterThan(1024);

    const full = await fetch(url);
    expect(full.status).toBe(200);
    expect(full.headers.get("content-length")).toBe(String(size));
    await full.body?.cancel();

    const open = await fetch(url, { headers: { Range: "bytes=1024-" } });
    expect(open.status).toBe(206);
    expect(open.headers.get("content-range")).toBe(`bytes 1024-${size - 1}/${size}`);
    await open.body?.cancel();

    const suffix = await fetch(url, { headers: { Range: "bytes=-128" } });
    expect(suffix.status).toBe(206);
    expect(suffix.headers.get("content-range")).toBe(`bytes ${size - 128}-${size - 1}/${size}`);
    expect((await suffix.arrayBuffer()).byteLength).toBe(128);

    const invalid = await fetch(url, { headers: { Range: `bytes=${size}-` } });
    expect(invalid.status).toBe(416);
    expect(invalid.headers.get("content-range")).toBe(`bytes */${size}`);

    const query = await fetch(`${url}?cache-bust=1`, { headers: { Range: "bytes=0-15" } });
    expect(query.status).toBe(206);
    expect((await query.arrayBuffer()).byteLength).toBe(16);

    const post = await fetch(url, { method: "POST" });
    expect(post.headers.get("content-type")).not.toBe("video/webm");
    expect(post.headers.get("accept-ranges")).toBeNull();
  });

  it.skipIf(process.platform === "win32")("closes every media file after clients abort downloads", async () => {
    const origin = await startDevelopmentServer();
    const baseline = openMediaDescriptorCount();

    await Promise.all(Array.from({ length: 20 }, () => new Promise<void>((resolve, reject) => {
      const request = get(`${origin}/video/liang-evolution.webm`);
      request.once("error", reject);
      request.once("response", (response) => {
        response.once("data", () => {
          response.destroy();
          resolve();
        });
      });
    })));

    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(openMediaDescriptorCount()).toBe(baseline);
  });
});
