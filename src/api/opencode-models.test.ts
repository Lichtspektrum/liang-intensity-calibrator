import { describe, expect, it, vi } from "vitest";

import { handleGetOpenCodeModels } from "./opencode-models";

describe("opencode models API", () => {
  it("returns discovered models and the active model", async () => {
    const loader = vi.fn(async () => [
      "opencode/deepseek-v4-flash-free",
      "opencode-go/deepseek-v4-flash",
    ]);
    const response = await handleGetOpenCodeModels(loader);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      models: ["opencode/deepseek-v4-flash-free", "opencode-go/deepseek-v4-flash"],
      active: "opencode/deepseek-v4-flash-free",
      activeInList: true,
    });
    expect(loader).toHaveBeenCalledOnce();
  });

  it("reports when the active model is not in the discovered list", async () => {
    const response = await handleGetOpenCodeModels(async () => ["opencode-go/glm-5.1"]);
    await expect(response.json()).resolves.toMatchObject({ activeInList: false });
  });
});
