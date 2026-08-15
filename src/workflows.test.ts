import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

function readProjectFile(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const workerWorkflow = readProjectFile(".github/workflows/deploy-worker.yml");
const pagesWorkflow = readProjectFile(".github/workflows/deploy-pages.yml");
const readme = readProjectFile("README.md");
const cloudflareTypes = readProjectFile("src/cloudflare.d.ts");
const wayfinderMap = readProjectFile("docs/wayfinder/MAP.md");

function sectionBetween(source: string, start: string, end?: string): string {
  const startIndex = source.indexOf(start);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  const endIndex = end ? source.indexOf(end, startIndex + start.length) : -1;
  return source.slice(startIndex, endIndex < 0 ? undefined : endIndex);
}

function runApiUrlGuard(value?: string) {
  const env = { ...process.env };
  if (value === undefined) delete env.VITE_API_BASE_URL;
  else env.VITE_API_BASE_URL = value;

  return spawnSync(process.execPath, ["scripts/validate-api-base-url.mjs"], {
    cwd: projectRoot,
    env,
    encoding: "utf8",
  });
}

describe("Worker deployment workflow", () => {
  it("is manual and serializes deployments without cancelling an active run", () => {
    expect(workerWorkflow).toMatch(/^on:\s*\n\s+workflow_dispatch:\s*$/m);
    expect(workerWorkflow).not.toMatch(/^\s+(push|pull_request|schedule):/m);
    expect(workerWorkflow).toMatch(
      /^concurrency:\s*\n\s+group:\s*deploy-api-worker\s*\n\s+cancel-in-progress:\s*false$/m,
    );
  });

  it("runs install, verification, migration and deployment in order", () => {
    const commands = [
      "npm ci",
      "npm test -- --run",
      "npm run build",
      "wrangler d1 migrations apply DB --remote",
      "wrangler deploy",
    ];
    const positions = commands.map((command) => workerWorkflow.indexOf(command));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("scopes Cloudflare secrets to guarded migration and deploy steps", () => {
    expect(workerWorkflow).not.toMatch(/^\s{4}env:/m);
    expect(workerWorkflow.match(/secrets\.CLOUDFLARE_API_TOKEN/g)).toHaveLength(2);
    expect(workerWorkflow.match(/secrets\.CLOUDFLARE_ACCOUNT_ID/g)).toHaveLength(2);

    const migration = sectionBetween(
      workerWorkflow,
      "- name: Apply D1 migrations",
      "- name: Deploy Worker",
    );
    const deploy = sectionBetween(workerWorkflow, "- name: Deploy Worker");

    for (const step of [migration, deploy]) {
      expect(step).toContain("secrets.CLOUDFLARE_API_TOKEN");
      expect(step).toContain("secrets.CLOUDFLARE_ACCOUNT_ID");
      expect(step).toMatch(/-z "\$\{CLOUDFLARE_API_TOKEN:-\}"/);
      expect(step).toMatch(/-z "\$\{CLOUDFLARE_ACCOUNT_ID:-\}"/);
      expect(step).not.toMatch(/echo\s+.*\$\{?CLOUDFLARE_/);
    }

    expect(migration.indexOf("-z \"${CLOUDFLARE_API_TOKEN:-}\"")).toBeLessThan(
      migration.indexOf("wrangler d1 migrations apply"),
    );
    expect(deploy.indexOf("-z \"${CLOUDFLARE_API_TOKEN:-}\"")).toBeLessThan(
      deploy.indexOf("wrangler deploy"),
    );
  });
});

describe("Pages deployment workflow", () => {
  it("validates the repository API origin immediately before building", () => {
    const build = sectionBetween(
      pagesWorkflow,
      "- name: Validate API origin and build Pages",
      "- uses: actions/upload-pages-artifact",
    );

    expect(build).toContain("VITE_API_BASE_URL: ${{ vars.VITE_API_BASE_URL }}");
    expect(build).toContain("node scripts/validate-api-base-url.mjs");
    expect(build.indexOf("validate-api-base-url.mjs")).toBeLessThan(
      build.indexOf("npm run build:pages"),
    );
  });

  it("accepts an absolute HTTPS origin", () => {
    const result = runApiUrlGuard("https://liang-api.example.workers.dev");
    expect(result.status, result.stderr).toBe(0);
  });

  it("accepts a canonical HTTPS origin with a non-default port", () => {
    const result = runApiUrlGuard("https://liang-api.example.workers.dev:8443");
    expect(result.status, result.stderr).toBe(0);
  });

  it.each([
    ["unset", undefined],
    ["HTTP", "http://liang-api.example.workers.dev"],
    ["credentials", "https://user:pass@liang-api.example.workers.dev"],
    ["empty credentials", "https://@liang-api.example.workers.dev"],
    ["path", "https://liang-api.example.workers.dev/api"],
    ["query", "https://liang-api.example.workers.dev?preview=1"],
    ["hash", "https://liang-api.example.workers.dev#preview"],
    ["trailing slash", "https://liang-api.example.workers.dev/"],
    ["dot segment", "https://liang-api.example.workers.dev/."],
    ["encoded dot segments", "https://liang-api.example.workers.dev/%2e%2e"],
    ["explicit default port", "https://liang-api.example.workers.dev:443"],
    ["relative URL", "/api"],
  ])("rejects an invalid API origin: %s", (_label, value) => {
    const result = runApiUrlGuard(value);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("VITE_API_BASE_URL must be an absolute HTTPS origin");
  });
});

describe("deployment documentation and retired infrastructure", () => {
  it("contains no active R2 upload command anywhere in tracked operational files", () => {
    const trackedFiles = execFileSync("git", ["ls-files"], {
      cwd: projectRoot,
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean)
      .filter((path) => !path.startsWith("docs/plans/"))
      .filter((path) => !/(?:^|\/)(?:package-lock|pnpm-lock)\.yaml?$/.test(path))
      .filter((path) => path !== "package-lock.json")
      .filter((path) => path !== "src/workflows.test.ts");
    const forbiddenPatterns = [
      new RegExp(["wrangler", "r2", "(?:bucket|object)"].join("\\s+"), "i"),
      new RegExp(["media", "upload"].join(":"), "i"),
      new RegExp(["upload", "videos"].join("-"), "i"),
    ];
    const offenders: string[] = [];

    for (const path of trackedFiles) {
      const content = readFileSync(new URL(`../${path}`, import.meta.url));
      if (content.includes(0)) continue;
      const text = content.toString("utf8");
      if (forbiddenPatterns.some((pattern) => pattern.test(text))) offenders.push(path);
    }

    expect(offenders).toEqual([]);
  });

  it("removes unused KV and R2 Worker declarations", () => {
    expect(cloudflareTypes).not.toMatch(/KVNamespace|KVPutOptions|KVListOptions|R2Bucket|R2Object/);
  });

  it("describes the current Pages, API Worker and D1 architecture", () => {
    expect(wayfinderMap).toContain("GitHub Pages");
    expect(wayfinderMap).toContain("Cloudflare Worker");
    expect(wayfinderMap).toContain("D1");
    expect(wayfinderMap).not.toMatch(/Workers AI|Worker \+ Assets|\bKV\b|新闻采集|每日一票/);
  });

  it("keeps the README user-facing without install or deploy details", () => {
    expect(readme).toContain("[在线体验]");
    expect(readme).toContain("## 项目结构");
    expect(readme).toContain("coding agent");
    expect(readme).toContain("## 素材与致谢");
    expect(readme).not.toMatch(/npm install|openssl rand|wrangler login|CLOUDFLARE_API_TOKEN/);
  });
});
