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
