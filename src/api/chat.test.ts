import { afterEach, describe, expect, it, vi } from "vitest";
import { handlePostChat } from "./chat";
import type { Env } from "./shared";

function envWithOpenCode(response: unknown): Env {
  const statement = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ success: true }),
  };
  return {
    DB: { prepare: vi.fn().mockReturnValue(statement) } as unknown as AppDatabase,
    AI_RUNNER: vi.fn().mockResolvedValue(response),
    VOTER_HASH_SECRET: "a".repeat(32),
    ALLOWED_ORIGINS: "https://app.example",
  };
}

function request(body: unknown): Request {
  return new Request("https://api.example/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Client-IP": "203.0.113.8" },
    body: JSON.stringify(body),
  });
}

describe("chat API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calibrates deterministically and returns a simulated answer", async () => {
    const env = envWithOpenCode({
      answer: "我们可以先看真正的瓶颈。",
      calibrationSummary: "明显偏向原创与长期研究。",
      dimensions: { originality: 1, openness: 1, efficiency: 1, intelligence: 1, restraint: 1 },
    });
    const response = await handlePostChat(request({ message: "先做原创研究" }), env);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      score: 15,
      stage: "梁祖",
      answer: "我们可以先看真正的瓶颈。",
    });
    expect(env.AI_RUNNER).toHaveBeenCalledWith(
      expect.stringContaining("你现在进入“梁文锋”角色"),
      expect.any(String),
      expect.any(Object),
      { reasoningEffort: "low" },
    );
    expect((env.AI_RUNNER as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
      "不要提及 OpenCode",
    );
    expect((env.AI_RUNNER as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
      "Now speak as Wenfeng Liang.",
    );
  });

  it("passes prior turns into the next continuous reply", async () => {
    const env = envWithOpenCode({
      answer: "先把技术瓶颈量化。",
      calibrationSummary: "延续上文。",
      dimensions: { originality: 0, openness: 0, efficiency: 0, intelligence: 0, restraint: 0 },
    });
    const history = [
      { role: "user", content: "我们要不要扩产品线？" },
      { role: "assistant", content: "先看真正的技术瓶颈。" },
    ];
    const response = await handlePostChat(request({ message: "下一步呢？", history }), env);
    expect(response.status).toBe(200);
    const userPrompt = (env.AI_RUNNER as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
    expect(userPrompt).toContain("我们要不要扩产品线？");
    expect(userPrompt).toContain("先看真正的技术瓶颈。");
    expect(userPrompt).toContain("下一步呢？");
  });

  it("rejects empty or oversized input before inference", async () => {
    expect((await handlePostChat(request({ message: " " }), envWithOpenCode({}))).status).toBe(400);
    expect((await handlePostChat(request({ message: "x".repeat(2001) }), envWithOpenCode({}))).status).toBe(400);
  });

  it("fails gracefully when an on-demand CLI call fails", async () => {
    const env = envWithOpenCode({});
    env.AI_RUNNER = vi.fn().mockRejectedValue(new Error("CLI unavailable"));
    expect((await handlePostChat(request({ message: "test" }), env)).status).toBe(503);
  });

  it("rewrites a draft that identifies itself as OpenCode", async () => {
    const dimensions = { originality: 0.2, openness: 0.2, efficiency: 0.2, intelligence: 0.2, restraint: 0.2 };
    const env = envWithOpenCode({});
    env.AI_RUNNER = vi.fn()
      .mockResolvedValueOnce({
        answer: "我是 OpenCode AI 助手，无法扮演梁文锋。",
        calibrationSummary: "draft",
        dimensions,
      })
      .mockResolvedValueOnce({
        answer: "我更关心的是，这件事有没有形成真正的技术积累。",
        calibrationSummary: "重视长期技术积累。",
        dimensions,
      });

    const response = await handlePostChat(request({ message: "要不要追热点？" }), env);
    expect(response.status).toBe(200);
    const body = await response.json() as { answer: string; disclaimer: string };
    expect(body.answer).toContain("我更关心");
    expect(body.answer).not.toMatch(/OpenCode|AI 助手/u);
    expect(body.disclaimer).not.toContain("OpenCode");
    expect(env.AI_RUNNER).toHaveBeenCalledTimes(2);
    expect((env.AI_RUNNER as ReturnType<typeof vi.fn>).mock.calls[1][3]).toEqual({
      reasoningEffort: "low",
    });
  });
});
