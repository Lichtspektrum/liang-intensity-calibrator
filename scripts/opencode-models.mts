import { listOpenCodeModels, resolveOpenCodeModel } from "../src/opencode-runner";

// 自动发现并列出 opencode 可用模型（参考 super-opencode 的 fetch_opencode_models）。
// 用法：npm run opencode:models
const models = await listOpenCodeModels();
const active = resolveOpenCodeModel();
if (models.length === 0) {
  console.error("未发现模型：`opencode models` 无输出或执行失败。");
  process.exit(1);
}
console.log(`当前生效：${active}`);
console.log(`可用模型（${models.length} 个）：`);
for (const model of models) console.log(`  ${model}`);
