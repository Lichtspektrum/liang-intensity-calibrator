import type { Env } from "../api/shared";
import { todayInBeijing } from "../api/shared";
import { recordDailySnapshot } from "../api/timeline";
import { runNewsCollection } from "../cron/collect-news";

export async function handleScheduled(env: Env): Promise<void> {
  const today = todayInBeijing();
  await recordDailySnapshot(env, today);
  await runNewsCollection(env);
}
