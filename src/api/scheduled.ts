import type { Env } from "../api/shared";
import { previousBeijingDate } from "../api/shared";
import { refreshNewsCalibration } from "../api/news";
import { recordDailySnapshot } from "../api/timeline";

export async function handleScheduled(env: Env, now = Date.now()): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  if (new Date(now).getUTCHours() === 16) {
    tasks.push(recordDailySnapshot(env, previousBeijingDate(now), now));
  }
  if (env.AI_RUNNER) tasks.push(refreshNewsCalibration(env, now));
  await Promise.all(tasks);
}
