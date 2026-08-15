import { listOpenCodeModels, resolveOpenCodeModel } from "../opencode-runner";
import { jsonResponse } from "./shared";

/**
 * GET /api/opencode-models
 * 自动发现 opencode 可用模型（参考 super-opencode 的 fetch_opencode_models）：
 * 执行 `opencode models` 并返回模型 id 列表，同时给出当前生效模型。
 */
export async function handleGetOpenCodeModels(
  modelsLoader: () => Promise<string[]> = listOpenCodeModels,
): Promise<Response> {
  const models = await modelsLoader();
  const active = resolveOpenCodeModel();
  return jsonResponse({
    models,
    active,
    activeInList: models.includes(active),
  }, { headers: { "Cache-Control": "no-store" } });
}
