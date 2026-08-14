# GitHub Pages + D1 Voting Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep the public site on GitHub Pages while replacing PR #7's Worker/Assets/KV/R2/news stack with a small Cloudflare Worker + D1 API that stores one persistent vote per browser, enforces a three-hour update cooldown, and records daily score snapshots.

**Architecture:** GitHub Pages serves all HTML, JavaScript, images, posters, and both 6 MB evolution videos. A separate `workers.dev` Worker exposes only score, vote, and timeline endpoints; all state lives in two D1 tables. The browser remains fully usable when the API is offline and receives the backend URL through `VITE_API_BASE_URL`.

**Tech Stack:** TypeScript, Vite, GitHub Pages, Cloudflare Workers, D1, Vitest, Playwright, Wrangler

---

## Preconditions

- Work only in `/Users/ifanr/ClaudeProjects/滑动变祖器/.worktrees/pr-7-preview` on `codex/pr-7-preview`.
- Do not deploy, push, merge, edit GitHub Secrets, or touch the existing GitHub Pages production site during Tasks 1–10.
- Follow @superpowers:test-driven-development for each behavior change.
- Preserve PR #7 authorship; integration into a clean branch happens only after local acceptance.

### Task 1: Replace the legacy database schema with persistent ballots

**Files:**
- Replace: `migrations/0001_init.sql`
- Delete: `migrations/0002_add_vote_position.sql`
- Delete: `migrations/0003_signed_score.sql`
- Create: `src/schema.test.ts`

**Step 1: Write the failing schema test**

Read the migration text and assert that it contains only the two approved tables and their constraints:

```ts
// @vitest-environment node
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("D1 schema", () => {
  it("stores one persistent ballot per voter and one snapshot per day", async () => {
    const sql = await readFile(new URL("../migrations/0001_init.sql", import.meta.url), "utf8");
    expect(sql).toContain("CREATE TABLE voters");
    expect(sql).toContain("voter_hash TEXT PRIMARY KEY");
    expect(sql).toContain("CHECK(position BETWEEN -15 AND 15)");
    expect(sql).toContain("CREATE TABLE daily_snapshots");
    expect(sql).not.toContain("news_events");
    expect(sql).not.toContain("daily_votes");
  });
});
```

**Step 2: Run the test and verify RED**

Run: `npm test -- --run src/schema.test.ts`

Expected: FAIL because the current migration contains legacy daily vote and news tables.

**Step 3: Replace the migration**

Use this final fresh-database schema:

```sql
CREATE TABLE voters (
  voter_hash TEXT PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position BETWEEN -15 AND 15),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_voters_ip_created_at
  ON voters(ip_hash, created_at);

CREATE TABLE daily_snapshots (
  date TEXT PRIMARY KEY,
  score REAL NOT NULL CHECK(score BETWEEN -15 AND 15),
  voter_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
```

Delete migrations 0002 and 0003 because the user's D1 database will be new and has no production data to preserve.

**Step 4: Verify GREEN**

Run: `npm test -- --run src/schema.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add migrations src/schema.test.ts
git commit -m "feat: define persistent voter schema"
```

### Task 2: Add time, HMAC, and CORS primitives

**Files:**
- Modify: `src/api/shared.ts`
- Modify: `src/cloudflare.d.ts`
- Create: `src/api/shared.test.ts`

**Step 1: Write failing tests**

Cover these public helpers:

```ts
expect(getCooldownState(1_000, 1_000 + 3 * 60 * 60 * 1000 - 1)).toEqual({
  allowed: false,
  nextVoteAt: 1_000 + 3 * 60 * 60 * 1000,
});
expect(getCooldownState(1_000, 1_000 + 3 * 60 * 60 * 1000).allowed).toBe(true);
expect(previousBeijingDate(Date.UTC(2026, 7, 14, 16, 5))).toBe("2026-08-14");
expect(allowedOrigin("https://lichtspektrum.github.io", env)).toBe(true);
expect(allowedOrigin("https://example.com", env)).toBe(false);
expect(await hmacIdentifier("secret", "same")).toBe(await hmacIdentifier("secret", "same"));
expect(await hmacIdentifier("secret", "same")).not.toBe(await hmacIdentifier("other", "same"));
```

**Step 2: Run and verify RED**

Run: `npm test -- --run src/api/shared.test.ts`

Expected: FAIL because the helpers and new environment shape do not exist.

**Step 3: Implement the primitives**

Change `Env` to:

```ts
export interface Env {
  DB: D1Database;
  VOTER_HASH_SECRET: string;
  ALLOWED_ORIGINS: string;
}
```

Add constants and helpers:

```ts
export const VOTE_COOLDOWN_MS = 3 * 60 * 60 * 1000;
export const NEW_IDENTITIES_PER_IP_PER_DAY = 5;

export function getCooldownState(updatedAt: number, now = Date.now()) {
  const nextVoteAt = updatedAt + VOTE_COOLDOWN_MS;
  return { allowed: now >= nextVoteAt, nextVoteAt };
}

export async function hmacIdentifier(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
```

Parse `ALLOWED_ORIGINS` as a comma-separated exact allowlist. Add `corsHeaders(origin, env)` and Beijing-date helpers. Remove `ASSETS`, `KV`, `MEDIA`, `AI`, and the constant-salt `hashIp()` implementation.

**Step 4: Verify GREEN**

Run: `npm test -- --run src/api/shared.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/api/shared.ts src/api/shared.test.ts src/cloudflare.d.ts
git commit -m "feat: add voting security primitives"
```

### Task 3: Compute community state directly from D1

**Files:**
- Replace: `src/api/score.ts`
- Modify: `src/api/shared.ts`
- Modify: `src/score-engine.ts`
- Modify: `src/score-engine.test.ts`
- Create: `src/api/score.test.ts`
- Delete: `src/community-state.ts`
- Delete: `src/community-state.test.ts`

**Step 1: Write failing aggregate tests**

Define a pure aggregate mapper and test:

```ts
expect(scoreFromBallots({ voters: 4, total: 10 })).toBe(2.5);
expect(scoreFromBallots({ voters: 0, total: null })).toBe(0);
expect(scoreToStage(2.5)).toBe("梁圣");
```

Test that `getCommunityScore(env)` issues one aggregate query over `voters` and returns `score`, `voterCount`, positive/negative/neutral counts and points. Use a minimal fake `D1PreparedStatement` returning a known row.

**Step 2: Verify RED**

Run: `npm test -- --run src/score-engine.test.ts src/api/score.test.ts`

Expected: FAIL because the current score path depends on today's votes and KV state.

**Step 3: Implement the aggregate**

Use one SQL query:

```sql
SELECT
  COUNT(*) AS voters,
  AVG(position) AS score,
  SUM(CASE WHEN position > 0 THEN 1 ELSE 0 END) AS positive_count,
  SUM(CASE WHEN position < 0 THEN 1 ELSE 0 END) AS negative_count,
  SUM(CASE WHEN position = 0 THEN 1 ELSE 0 END) AS neutral_count,
  SUM(CASE WHEN position > 0 THEN position ELSE 0 END) AS positive_points,
  SUM(CASE WHEN position < 0 THEN position ELSE 0 END) AS negative_points
FROM voters
```

Return rounded score precision of two decimals. Remove half-life decay, cold-start state, KV reads/writes, news events and daily-only aggregation.

Update `ScoreResponse` to include `voterCount` and remove `isColdStart` and `recentEvents`.

**Step 4: Verify GREEN**

Run: `npm test -- --run src/score-engine.test.ts src/api/score.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/api/score.ts src/api/shared.ts src/score-engine.ts src/score-engine.test.ts src/api/score.test.ts src/community-state.ts src/community-state.test.ts
git commit -m "feat: derive community score from active ballots"
```

### Task 4: Replace daily voting with three-hour ballot updates

**Files:**
- Replace: `src/api/vote.ts`
- Create: `src/api/vote.test.ts`

**Step 1: Write failing handler tests**

Cover five cases with a fake D1 adapter:

1. New fingerprint inserts one voter and returns `nextVoteAt`.
2. Existing fingerprint inside three hours returns `429`, `reason: "cooldown"`, saved position and the same `nextVoteAt`.
3. Existing fingerprint after three hours updates the row instead of inserting another.
4. A sixth new fingerprint from the same IP within rolling 24 hours returns `429`, `reason: "rate_limited"`.
5. Invalid origin, fingerprint and position are rejected before any database write.

Example response assertion:

```ts
expect(response.status).toBe(429);
expect(await response.json()).toMatchObject({
  accepted: false,
  reason: "cooldown",
  userPosition: 6,
  nextVoteAt: updatedAt + VOTE_COOLDOWN_MS,
});
```

**Step 2: Verify RED**

Run: `npm test -- --run src/api/vote.test.ts`

Expected: FAIL because the current handler keys votes by fingerprint and Beijing date and uses KV rate limiting.

**Step 3: Implement the handler**

- Validate request body and exact Origin.
- HMAC the fingerprint and `CF-Connecting-IP` with `VOTER_HASH_SECRET`.
- Read `voters` by `voter_hash`.
- Enforce the three-hour cooldown for existing voters.
- For new voters, count rows with the same `ip_hash` and `created_at >= now - 24h`.
- Insert or update one row.
- Query the new community aggregate.
- Return `accepted`, `userPosition`, `nextVoteAt` and the community response.

Do not log the raw request body, fingerprint or IP.

**Step 4: Verify GREEN**

Run: `npm test -- --run src/api/vote.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/api/vote.ts src/api/vote.test.ts
git commit -m "feat: enforce three-hour ballot updates"
```

### Task 5: Simplify timeline snapshots and scheduled work

**Files:**
- Replace: `src/api/timeline.ts`
- Replace: `src/api/scheduled.ts`
- Create: `src/api/timeline.test.ts`
- Delete: `src/cron/collect-news.ts`

**Step 1: Write failing timeline tests**

Cover:

- `GET /api/timeline` returns at most 90 snapshots, ordered ascending for the UI.
- Timeline items contain `date`, `score`, `stage`, and `voterCount`, with no events.
- The scheduled handler snapshots the previous Beijing date.
- Snapshot insert uses `ON CONFLICT(date) DO UPDATE` so retries are idempotent.

**Step 2: Verify RED**

Run: `npm test -- --run src/api/timeline.test.ts`

Expected: FAIL because the current timeline queries news events and legacy snapshot columns.

**Step 3: Implement timeline and snapshot logic**

Use:

```sql
SELECT date, score, voter_count
FROM daily_snapshots
ORDER BY date DESC
LIMIT 90
```

Reverse results before returning. The scheduled handler obtains the current aggregate and upserts the previous Beijing date. Remove hourly news collection.

**Step 4: Verify GREEN**

Run: `npm test -- --run src/api/timeline.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/api/timeline.ts src/api/timeline.test.ts src/api/scheduled.ts src/cron/collect-news.ts
git commit -m "feat: record daily community snapshots"
```

### Task 6: Turn the Worker into a CORS API only

**Files:**
- Replace: `src/worker.ts`
- Replace: `wrangler.json`
- Modify: `src/sites-worker.test.ts`
- Delete: `src/media-response.ts`
- Delete: `src/media-response.test.ts`
- Delete: `src/server-render.ts`
- Delete: `src/server-render.test.ts`
- Delete: `src/initial-state.ts`

**Step 1: Rewrite the Worker tests first**

Test:

- `OPTIONS /api/*` returns `204` with the requested allowed origin.
- Allowed-origin GET and POST responses contain matching CORS headers.
- Unknown API paths return JSON `404`.
- Non-API paths are not served by Worker Assets.
- Disallowed origins receive `403`.

**Step 2: Verify RED**

Run: `npm run build && npm test -- --run src/sites-worker.test.ts`

Expected: FAIL because the Worker currently serves HTML, R2 video and local reset routes.

**Step 3: Implement the API router**

The Worker handles only:

```text
OPTIONS /api/*
GET     /api/score
POST    /api/vote
GET     /api/timeline
```

Remove Assets, SSR, media and timeline-day routes. Wrap all API responses with exact-origin CORS headers.

Use a placeholder-free local-safe Wrangler config:

```json
{
  "name": "liang-intensity-api",
  "main": "./src/worker.ts",
  "compatibility_date": "2026-08-08",
  "workers_dev": true,
  "vars": {
    "ALLOWED_ORIGINS": "https://lichtspektrum.github.io,http://127.0.0.1:5173,http://127.0.0.1:5174"
  },
  "d1_databases": [{
    "binding": "DB",
    "database_name": "liang-intensity-db",
    "database_id": "local-preview",
    "migrations_dir": "./migrations"
  }],
  "triggers": { "crons": ["5 16 * * *"] }
}
```

The real D1 ID replaces `local-preview` only during the later deployment stage. Store `VOTER_HASH_SECRET` using Wrangler secrets; local development uses `.dev.vars`, which must remain gitignored.

**Step 4: Verify GREEN**

Run: `npm run build && npm test -- --run src/sites-worker.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src wrangler.json
git commit -m "refactor: expose voting API only"
```

### Task 7: Make the frontend consume a separate API

**Files:**
- Modify: `src/api.ts`
- Replace: `src/main.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `src/video-renderer.ts`
- Modify: `src/video-renderer.test.ts`
- Create: `src/api.test.ts`
- Create: `scripts/copy-pages-media.mjs`
- Modify: `package.json`

**Step 1: Write failing frontend boundary tests**

Test that:

- `createApiClient("https://api.example.workers.dev")` calls absolute `/api/score`, `/api/vote`, and `/api/timeline` URLs.
- A missing `VITE_API_BASE_URL` produces an explicit community-unavailable state rather than calling the GitHub Pages origin.
- Video URLs use `import.meta.env.BASE_URL`, producing `/liang-intensity-calibrator/video/...` in Pages mode.
- The Pages media copy script copies the two tracked files from `media/` into `dist-pages/video/` without creating `public/video` duplicates.

**Step 2: Verify RED**

Run: `npm test -- --run src/api.test.ts src/video-renderer.test.ts`

Expected: FAIL because API and video paths are root-relative.

**Step 3: Implement the API client and static bootstrap**

- Add `VITE_API_BASE_URL` typing.
- Export `createApiClient(baseUrl)` with `fetchScore()`, `submitVote()`, and `fetchTimeline()`.
- Remove SSR initial-state requirements from `main.ts`.
- Mount the app immediately with the score-0 poster, load the video from Pages, then fetch community data independently.
- Keep slider and portrait available if the fetch fails.
- Use a persistent localStorage record:

```ts
interface StoredVote {
  position: number;
  nextVoteAt: number;
}
```

- Change `build:pages` to run the media copy script after Vite.

**Step 4: Verify GREEN**

Run: `npm test -- --run src/api.test.ts src/video-renderer.test.ts`

Expected: PASS.

**Step 5: Verify Pages assets**

Run: `npm run build:pages`

Expected: `dist-pages/video/liang-evolution.webm` and `.mp4` exist; each remains below 25 MiB.

**Step 6: Commit**

```bash
git add src scripts/copy-pages-media.mjs package.json
git commit -m "feat: connect Pages frontend to voting API"
```

### Task 8: Implement cooldown and backend-failure UI states

**Files:**
- Modify: `src/app.ts`
- Modify: `src/app.test.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`

**Step 1: Write failing UI tests**

Add controller tests for:

```ts
controller.setCooldown(2 * 60 * 60 * 1000 + 18 * 60 * 1000);
expect(status.textContent).toBe("还需 2 小时 18 分才能修改投票");

controller.setCommunityUnavailable();
expect(status.textContent).toBe("社区数据暂时无法加载");
expect(ghostThumb.hidden).toBe(true);

controller.setVoteError();
expect(status.textContent).toBe("提交失败，请稍后重试");
```

Test that a change during cooldown calls no API method and restores the saved vote position while `input` events still preview the portrait.

**Step 2: Verify RED**

Run: `npm test -- --run src/app.test.ts`

Expected: FAIL because these controller states do not exist.

**Step 3: Implement minimal UI state methods**

- Add `setCooldown(remainingMs)`, `setCommunityUnavailable()`, `setVoteError()`, and `restoreVote(position)`.
- Change the fixed hint to end with `每 3 小时可修改一次。`
- During cooldown, allow `input`; on `change`, restore the saved position and show remaining time.
- On failed POST, restore the last successful position and do not update localStorage.
- Hide the ghost thumb until community data loads successfully.

**Step 4: Verify GREEN**

Run: `npm test -- --run src/app.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app.ts src/app.test.ts src/main.ts src/styles.css
git commit -m "feat: explain vote cooldown and API failures"
```

### Task 9: Update browser tests for static Pages plus API failures

**Files:**
- Modify: `tests/initial-portrait.spec.ts`
- Modify: `tests/slider.spec.ts`
- Modify: `playwright.config.ts`

**Step 1: Add failing browser scenarios**

Route the configured API origin and cover:

- Initial community score loads and places the gray marker.
- Successful vote displays personal and community scores and stores `nextVoteAt`.
- A second change during cooldown previews, then restores the saved position and shows remaining time.
- A failed score request hides the gray marker but leaves the slider enabled.
- A failed vote restores the last successful position.
- Desktop and mobile Pages builds have no horizontal overflow.

**Step 2: Verify RED**

Run: `npm run test:e2e`

Expected: new scenarios FAIL until the static/API test harness is configured.

**Step 3: Configure the test harness**

Set `VITE_API_BASE_URL=http://127.0.0.1:8787` for the Pages dev server. Route that absolute origin in Playwright. Keep video Range requests on the Pages server.

**Step 4: Verify GREEN**

Run: `npm run test:e2e`

Expected: all desktop and mobile tests PASS.

**Step 5: Commit**

```bash
git add tests playwright.config.ts
git commit -m "test: cover split frontend and voting API"
```

### Task 10: Add deployment configuration without deploying

**Files:**
- Create: `.github/workflows/deploy-worker.yml`
- Modify: `.github/workflows/deploy-pages.yml`
- Modify: `README.md`
- Delete: `scripts/media/upload-videos.sh`
- Modify: `package.json`

**Step 1: Add a static workflow test**

Create `src/workflows.test.ts` that reads both workflow files and asserts:

- Worker deployment initially supports `workflow_dispatch` only.
- It references `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets.
- Pages build receives `VITE_API_BASE_URL` from a repository variable.
- No workflow uploads to R2.

**Step 2: Verify RED**

Run: `npm test -- --run src/workflows.test.ts`

Expected: FAIL because the Worker workflow and Pages API variable do not exist.

**Step 3: Add non-production deployment files**

- `deploy-worker.yml` uses `workflow_dispatch`, `npm ci`, `npm test -- --run`, `npm run build`, `wrangler d1 migrations apply DB --remote`, and `wrangler deploy`.
- `deploy-pages.yml` passes `VITE_API_BASE_URL: ${{ vars.VITE_API_BASE_URL }}` only at build time.
- README documents local dual-server development, D1 creation, Wrangler secret setup, GitHub Secrets, the repository variable and rollback.
- Remove R2 upload commands and dependencies from package scripts/docs.
- Do not run either workflow or create Cloudflare resources yet.

**Step 4: Verify GREEN**

Run: `npm test -- --run src/workflows.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add .github README.md package.json scripts src/workflows.test.ts
git commit -m "ci: prepare separate Worker deployment"
```

### Task 11: Run the full local acceptance suite

**Files:**
- Verify only

**Step 1: Create a temporary local secret file**

Create `.dev.vars` locally with a random development-only `VOTER_HASH_SECRET`. Confirm `.dev.vars` is ignored. Never commit or print its contents.

**Step 2: Apply migrations to an isolated local D1 state**

Run:

```bash
npx wrangler d1 migrations apply DB --local
```

Expected: the fresh `voters` and `daily_snapshots` schema applies successfully.

**Step 3: Run the production builds**

```bash
npm run build
npm run build:pages
```

Expected: both Worker and GitHub Pages builds succeed.

**Step 4: Run all tests**

```bash
npm test -- --run
npm run test:e2e
```

Expected: all Vitest and Playwright tests pass.

**Step 5: Run both local servers**

```bash
npx wrangler dev --port 8787
VITE_API_BASE_URL=http://127.0.0.1:8787 npm run dev -- --host 127.0.0.1 --port 5174
```

Expected: the Pages frontend opens at `http://127.0.0.1:5174/`, loads community data from port 8787, accepts one vote, blocks a second update for three hours, and keeps the portrait preview usable.

**Step 6: Inspect without touching production**

Use the in-app browser to verify the successful vote, cooldown recovery, backend-offline state and timeline layout. Keep the local preview open for user acceptance.

**Step 7: Verify repository state**

```bash
git status --short
git diff --check
rg -n "ds\.uu0uu\.com|R2|MEDIA|KV|news_events|runNewsCollection" src wrangler.json README.md .github package.json
```

Expected: no uncommitted source changes, no whitespace errors, and no legacy production bindings or news/R2 code outside historical design documents.

## Deferred until explicit user approval

- Creating the user's Cloudflare D1 database.
- Replacing the placeholder D1 ID.
- Adding Wrangler and GitHub secrets.
- Deploying a temporary or production Worker.
- Updating the production GitHub Pages API variable.
- Creating the clean integration branch and new PR.
- Posting comments on PR #7, inviting `@loggerhead`, merging, or closing either PR.
