import { describe, expect, it, vi } from "vitest";
import { OPENCODE_MODEL, runStructuredAi } from "./ai-runtime";

describe("on-demand OpenCode runtime", () => {
  it("passes structured work to one CLI invocation", async () => {
    const runner = vi.fn().mockResolvedValue({ answer: "ok" });
    await expect(runStructuredAi(
      "system",
      "user",
      { type: "object", required: ["answer"] },
      {},
      runner,
    )).resolves.toEqual({ answer: "ok" });
    expect(runner).toHaveBeenCalledWith({
      system: "system",
      user: "user",
      schema: { type: "object", required: ["answer"] },
    }, {});
    expect(OPENCODE_MODEL).toBe("opencode/deepseek-v4-flash-free");
  });

  it("propagates CLI failures without requiring a service", async () => {
    const runner = vi.fn().mockRejectedValue(new Error("CLI unavailable"));
    await expect(runStructuredAi("system", "user", {}, {}, runner))
      .rejects.toThrow("CLI unavailable");
  });
});
