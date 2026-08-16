import type { NewsCalibration } from "../ai-news-analyzer";
import {
  getCachedNewsCalibration,
  NEWS_CACHE_TTL_MS,
  refreshNewsCalibration,
  type NewsPipelineProgress,
  type NewsVariant,
} from "./news";
import { jsonResponse, todayInBeijing, type Env } from "./shared";

export type NewsJobStatus = "running" | "completed" | "failed";

export interface NewsProgressEvent {
  id: number;
  progress: number;
  stage: string;
  label: string;
  detail: string;
  at: number;
}

export interface NewsJobSnapshot {
  id: string;
  status: NewsJobStatus;
  variant: NewsVariant;
  progress: number;
  stage: string;
  label: string;
  detail: string;
  startedAt: number;
  updatedAt: number;
  elapsedMs: number;
  stats: NonNullable<NewsPipelineProgress["stats"]>;
  events: NewsProgressEvent[];
  result?: NewsCalibration;
}

interface NewsJob extends Omit<NewsJobSnapshot, "elapsedMs"> {
  force: boolean;
}

const jobs = new Map<string, NewsJob>();
let activeJobId: string | null = null;
let nextEventId = 1;
const JOB_TTL_MS = 60 * 60 * 1_000;

function snapshot(job: NewsJob, now = Date.now()): NewsJobSnapshot {
  const { force: _force, ...data } = job;
  return { ...data, elapsedMs: Math.max(0, now - job.startedAt) };
}

function cleanup(now: number): void {
  for (const [id, job] of jobs) {
    if (job.status !== "running" && now - job.updatedAt > JOB_TTL_MS) jobs.delete(id);
  }
}

function updateJob(job: NewsJob, update: NewsPipelineProgress): void {
  const now = Date.now();
  const progress = Math.max(job.progress, Math.min(100, Math.round(update.progress)));
  job.progress = progress;
  job.stage = update.stage;
  job.label = update.label;
  job.detail = update.detail;
  job.updatedAt = now;
  job.stats = { ...job.stats, ...update.stats };
  const previous = job.events.at(-1);
  if (!previous || previous.stage !== update.stage || previous.detail !== update.detail) {
    job.events.push({
      id: nextEventId++,
      progress,
      stage: update.stage,
      label: update.label,
      detail: update.detail,
      at: now,
    });
    if (job.events.length > 32) job.events.splice(0, job.events.length - 32);
  }
}

async function runJob(job: NewsJob, env: Env): Promise<void> {
  try {
    // 快速版不读深度缓存，直接现场跑规则信号（便宜、按小时幂等）。
    if (job.variant !== "quick") {
      const cached = await getCachedNewsCalibration(env, todayInBeijing(job.startedAt));
      if (cached && job.startedAt - cached.collectedAt < NEWS_CACHE_TTL_MS) {
        updateJob(job, {
          progress: 100,
          stage: "cached",
          label: "读取今日缓存",
          detail: `${cached.items.length} 条当日新闻仍在有效期内，无需重复调用模型`,
          stats: { uniqueItems: cached.items.length },
        });
        job.result = cached;
        job.status = "completed";
        return;
      }
    }
    job.result = await refreshNewsCalibration(env, job.startedAt, (update) => updateJob(job, update), job.variant);
    job.status = "completed";
  } catch {
    job.status = "failed";
    updateJob(job, {
      progress: job.progress,
      stage: "failed",
      label: "本次采集未完成",
      detail: "已保留可复用的数据；请稍后重新读取",
    });
  } finally {
    job.updatedAt = Date.now();
    if (activeJobId === job.id) activeJobId = null;
  }
}

export function startNewsJob(
  env: Env,
  force = false,
  now = Date.now(),
  variant: NewsVariant = "quick",
): NewsJobSnapshot {
  cleanup(now);
  if (activeJobId) {
    const active = jobs.get(activeJobId);
    if (active?.status === "running") return snapshot(active, now);
  }
  const id = crypto.randomUUID();
  const job: NewsJob = {
    id,
    force,
    variant,
    status: "running",
    progress: 1,
    stage: "queued",
    label: "建立今日采集任务",
    detail: "准备可信源、日期边界与梁文锋分析 skill",
    startedAt: now,
    updatedAt: now,
    stats: {},
    events: [{
      id: nextEventId++,
      progress: 1,
      stage: "queued",
      label: "建立今日采集任务",
      detail: "准备可信源、日期边界与梁文锋分析 skill",
      at: now,
    }],
  };
  jobs.set(id, job);
  activeJobId = id;
  void runJob(job, env);
  return snapshot(job, now);
}

export function getNewsJob(id: string, now = Date.now()): NewsJobSnapshot | null {
  const job = jobs.get(id);
  return job ? snapshot(job, now) : null;
}

export async function handlePostNewsJob(request: Request, env: Env): Promise<Response> {
  let force = false;
  let variant: NewsVariant = "quick";
  try {
    const body = await request.json() as { force?: unknown; variant?: unknown };
    force = body?.force === true;
    if (body?.variant === "quick") variant = "quick";
  } catch {
    // An empty body starts a normal cache-aware collection.
  }
  return jsonResponse(startNewsJob(env, force, Date.now(), variant), {
    status: 202,
    headers: { "Cache-Control": "no-store" },
  });
}

export function handleGetNewsJob(id: string): Response {
  if (!/^[0-9a-f-]{36}$/iu.test(id)) {
    return jsonResponse({ error: "invalid job id" }, { status: 400 });
  }
  const job = getNewsJob(id);
  return job
    ? jsonResponse(job, { headers: { "Cache-Control": "no-store" } })
    : jsonResponse({ error: "job not found" }, { status: 404 });
}
