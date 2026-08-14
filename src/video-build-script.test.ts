import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

function scriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    return statSync(path).isDirectory() ? scriptFiles(path) : [path];
  });
}

describe("video build scripts", () => {
  it.each([
    "build-full-video.sh",
    "build-prototype.sh",
  ])("builds %s from media source frames", (filename) => {
    const script = readFileSync(resolve(projectRoot, "scripts/video", filename), "utf8");

    expect(script).toContain('SOURCE_DIR="$PROJECT_ROOT/media/source-frames"');
  });

  it("writes deployable video into media", () => {
    const script = readFileSync(resolve(projectRoot, "scripts/video/build-full-video.sh"), "utf8");

    expect(script).toContain('OUTPUT_DIR="$PROJECT_ROOT/media"');
  });

  it("does not let repository tools write generated video into public/video", () => {
    const offenders = scriptFiles(resolve(projectRoot, "scripts"))
      .filter((path) => readFileSync(path, "utf8").includes("public/video"));

    expect(offenders).toEqual([]);
  });
});
