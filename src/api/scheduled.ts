import type { Env } from "../api/shared";
import { previousBeijingDate } from "../api/shared";
import { recordDailySnapshot } from "../api/timeline";

export async function handleScheduled(env: Env, now = Date.now()): Promise<void> {
  await recordDailySnapshot(env, previousBeijingDate(now), now);
}
