# T11: API 契约定义

**类型**: implemented
**状态**: done
**依赖**: T3（算法）, T7（schema）, T8（去重）, T9（冷启动）
**阻塞**: T12（前端集成）

## Current Endpoints

### GET /api/score

Returns the current community score and recent timeline events.

```ts
interface ScoreResponse {
  score: number;          // 0-30, rounded to 2 decimals
  level: number;          // same scale as score
  stage: string;
  upCount: number;
  downCount: number;
  upVotePoints: number;
  downVotePoints: number;
  isColdStart: boolean;
  recentEvents: TimelineEventResponse[];
}
```

Headers:

```http
Cache-Control: no-store
```

### POST /api/vote

Submits or updates the current user's vote for the Beijing-calendar day.

Request:

```ts
interface VoteRequest {
  fingerprint: string; // length 8-128
  position: number;    // integer 0-30
}
```

Server behavior:

- Requires same-origin `Origin` or `Referer`.
- Reads `CF-Connecting-IP` for per-IP new-voter rate limiting.
- Stores `position` and derived `direction` in `votes`.
- Uses upsert on `fingerprint + date`, so same-day revotes replace the previous position.
- Recomputes score from the average same-day vote position.

Response:

```ts
interface VoteResponse {
  accepted: boolean;
  reason?: "rate_limited" | "invalid_position" | "invalid_fingerprint";
  userPosition: number;
  score: number;
  level: number;
  stage: string;
  upCount: number;
  downCount: number;
  upVotePoints: number;
  downVotePoints: number;
}
```

Other error reasons currently returned by implementation include `invalid_body` and `csrf`.

### GET /api/timeline

Query params:

- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`

Invalid date params are ignored. Returns ascending day snapshots with events for each date.

Headers:

```http
Cache-Control: public, max-age=3600
```

### GET /api/timeline/:date

Returns one day of timeline data. `date` must match `YYYY-MM-DD`; missing dates return 404.

## Deployment Contract

The frontend and API are same-origin under the Cloudflare Worker domain. Current production deployment:

- Worker name: `ds-liang`
- Custom domain: `ds.uu0uu.com`
- D1 binding: `DB`
- KV binding: `KV`
- Assets binding: `ASSETS`

No CORS is required for browser calls from the deployed frontend.
