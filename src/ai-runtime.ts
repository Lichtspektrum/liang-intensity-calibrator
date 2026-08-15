import { runOpenCode, OPENCODE_MODEL } from "./opencode-runner";

export { OPENCODE_MODEL };

export interface StructuredAiPayload {
  system: string;
  user: string;
  schema: Record<string, unknown>;
}

export interface StructuredAiOptions {
  reasoningEffort?: "low" | "medium" | "high";
  onActivity?: (detail: string) => void;
  /** 逐请求指定 opencode 模型（如前端选择器），未提供时用环境变量/默认值。 */
  model?: string;
}

export type OpenCodeRunner = (
  payload: StructuredAiPayload,
  options?: StructuredAiOptions,
) => Promise<unknown>;

export async function runStructuredAi(
  system: string,
  user: string,
  schema: Record<string, unknown>,
  options: StructuredAiOptions = {},
  runner: OpenCodeRunner = runOpenCode,
): Promise<unknown> {
  return runner({ system, user, schema }, options);
}

export type StructuredAiRunner = typeof runStructuredAi;
