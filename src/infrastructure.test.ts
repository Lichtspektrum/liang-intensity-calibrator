import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("local infrastructure", () => {
  it("has no vendor worker configuration or deployment workflow", () => {
    expect(existsSync(`${root}/src/worker.ts`)).toBe(false);
    expect(existsSync(`${root}/.github/workflows/deploy-worker.yml`)).toBe(false);
  });

  it("uses Node, SQLite, and the on-demand OpenCode CLI", () => {
    const packageJson = JSON.parse(read("package.json"));
    const server = read("src/server.ts");
    expect(packageJson.scripts["dev:api"]).toContain("tsx");
    expect(server).toContain("LocalDatabase");
    expect(read("src/opencode-runner.ts")).toContain("spawn(binary");
  });
});
