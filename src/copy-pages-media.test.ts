import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const script = resolve("scripts/copy-pages-media.mjs");
const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

async function fixture(): Promise<string> {
  const directory = await mkdtemp(resolve(tmpdir(), "liang-pages-media-"));
  tempDirectories.push(directory);
  await mkdir(resolve(directory, "media"));
  await mkdir(resolve(directory, "dist-pages/video"), { recursive: true });
  await writeFile(resolve(directory, "media/liang-evolution.webm"), "webm");
  await writeFile(resolve(directory, "media/liang-evolution.mp4"), "mp4");
  await writeFile(resolve(directory, "dist-pages/video/stale.txt"), "stale");
  return directory;
}

describe("copy-pages-media", () => {
  it("清理目标目录后只复制两个跟踪媒体文件", async () => {
    const directory = await fixture();

    await execFileAsync(process.execPath, [script], { cwd: directory });

    await expect(readFile(resolve(directory, "dist-pages/video/liang-evolution.webm"), "utf8"))
      .resolves.toBe("webm");
    await expect(readFile(resolve(directory, "dist-pages/video/liang-evolution.mp4"), "utf8"))
      .resolves.toBe("mp4");
    await expect(readFile(resolve(directory, "dist-pages/video/stale.txt"), "utf8"))
      .rejects.toThrow();
  });

  it("拒绝复制达到 25 MiB 的单个媒体文件", async () => {
    const directory = await fixture();
    await writeFile(
      resolve(directory, "media/liang-evolution.mp4"),
      Buffer.alloc(25 * 1024 * 1024),
    );

    await expect(execFileAsync(process.execPath, [script], { cwd: directory }))
      .rejects.toMatchObject({ stderr: expect.stringContaining("25 MiB") });
  });
});
