import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanAnswerText, handlePostChat } from "./chat";
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

describe("cleanAnswerText", () => {
  it("turns literal escaped newlines into real line breaks", () => {
    expect(cleanAnswerText("第一段。\\n\\n第二段。")).toBe("第一段。\n\n第二段。");
  });

  it("collapses excessive blank lines", () => {
    expect(cleanAnswerText("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("handles doubled escaping and carriage returns", () => {
    expect(cleanAnswerText("行一\\\\n行二\\r\\n行三")).toBe("行一\n行二\n行三");
  });

  it("trims surrounding whitespace", () => {
    expect(cleanAnswerText("  前后留白  ")).toBe("前后留白");
  });

  it("leaves clean text untouched", () => {
    expect(cleanAnswerText("正常回答。")).toBe("正常回答。");
  });
});

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
      "现在以梁文锋口吻回答",
    );
    expect((env.AI_RUNNER as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
      "允许你使用 websearch/webfetch 联网核实",
    );
    expect((env.AI_RUNNER as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
      "小难梁（梁认怂）",
    );
    expect((env.AI_RUNNER as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
      "总分越高对应梁圣及以上（DeepSeek 做出好模型、取得成就）",
    );
    expect((env.AI_RUNNER as ReturnType<typeof vi.fn>).mock.calls[0][0]).not.toContain(
      "评估当前用户输入本身与五个思考镜片的吻合程度",
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

  it("uses stored history and persists both turns with the per-answer score", async () => {
    const binds: unknown[][] = [];
    const statement = {
      bind: vi.fn(function (this: unknown, ...values: unknown[]) {
        binds.push(values);
        return this;
      }),
      first: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "00000000-0000-4000-8000-000000000001",
          title: "先做原创研究",
        })
        .mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({
        success: true,
        results: [
          { role: "user", content: "先做原创研究" },
          { role: "assistant", content: "先看真正的瓶颈。" },
        ],
      }),
      run: vi.fn().mockResolvedValue({ success: true }),
    };
    const env = {
      DB: { prepare: vi.fn().mockReturnValue(statement) } as unknown as AppDatabase,
      AI_RUNNER: vi.fn().mockResolvedValue({
        answer: "把技术瓶颈量化。",
        calibrationSummary: "延续上文。",
        dimensions: { originality: 0.4, openness: 0.1, efficiency: 0.3, intelligence: 0.5, restraint: 0.1 },
      }),
      VOTER_HASH_SECRET: "a".repeat(32),
      ALLOWED_ORIGINS: "https://app.example",
    };

    const response = await handlePostChat(
      request({ message: "下一步呢？", conversationId: "00000000-0000-4000-8000-000000000001" }),
      env,
    );
    expect(response.status).toBe(200);
    const body = await response.json() as { conversation: { id: string; title: string } };
    expect(body.conversation).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      title: "先做原创研究",
    });

    const prompt = (env.AI_RUNNER as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
    expect(prompt).toContain("先做原创研究");
    expect(prompt).toContain("先看真正的瓶颈。");
    expect(prompt).toContain("下一步呢？");

    const userInsert = binds.find((values) => values[1] === "user");
    const assistantInsert = binds.find((values) => values[1] === "assistant");
    expect(userInsert?.[2]).toBe("下一步呢？");
    expect(assistantInsert?.[2]).toBe("把技术瓶颈量化。");
    expect(assistantInsert?.[3]).toBe(4.8);
    expect(assistantInsert?.[4]).toBe("梁圣");
    expect(JSON.parse(String(assistantInsert?.[6]))).toMatchObject({ originality: 0.4 });
  });

  it("creates a conversation on the first message and returns its id", async () => {
    const binds: unknown[][] = [];
    const statement = {
      bind: vi.fn(function (this: unknown, ...values: unknown[]) {
        binds.push(values);
        return this;
      }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn(),
      run: vi.fn().mockResolvedValue({ success: true }),
    };
    const env = {
      DB: { prepare: vi.fn().mockReturnValue(statement) } as unknown as AppDatabase,
      AI_RUNNER: vi.fn().mockResolvedValue({
        answer: "先看真正的瓶颈。",
        calibrationSummary: "偏向主线。",
        dimensions: { originality: 0.5, openness: 0.2, efficiency: 0.2, intelligence: 0.4, restraint: 0.2 },
      }),
      VOTER_HASH_SECRET: "a".repeat(32),
      ALLOWED_ORIGINS: "https://app.example",
    };

    const response = await handlePostChat(request({ message: "我们要不要先扩产品线？" }), env);
    expect(response.status).toBe(200);
    const body = await response.json() as { conversation: { id: string; title: string } };
    expect(body.conversation.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu);
    expect(body.conversation.title).toBe("我们要不要先扩产品线？");

    const conversationInsert = binds.find((values) =>
      typeof values[0] === "string" && values[1] === "我们要不要先扩产品线？");
    expect(conversationInsert).toBeDefined();
  });

  it("creates a conversation when a client-provided id is not found yet", async () => {
    const binds: unknown[][] = [];
    const statement = {
      bind: vi.fn(function (this: unknown, ...values: unknown[]) {
        binds.push(values);
        return this;
      }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn(),
      run: vi.fn().mockResolvedValue({ success: true }),
    };
    const env = {
      DB: { prepare: vi.fn().mockReturnValue(statement) } as unknown as AppDatabase,
      AI_RUNNER: vi.fn().mockResolvedValue({
        answer: "先把瓶颈量化。",
        calibrationSummary: "偏向主线。",
        dimensions: { originality: 0.4, openness: 0.2, efficiency: 0.3, intelligence: 0.5, restraint: 0.2 },
      }),
      VOTER_HASH_SECRET: "a".repeat(32),
      ALLOWED_ORIGINS: "https://app.example",
    };

    const response = await handlePostChat(
      request({ message: "先做原创研究", conversationId: "00000000-0000-4000-8000-000000000001" }),
      env,
    );
    expect(response.status).toBe(200);
    const body = await response.json() as { conversation: { id: string; title: string } };
    expect(body.conversation).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      title: "先做原创研究",
    });
    const conversationInsert = binds.find((values) =>
      typeof values[0] === "string" && values[1] === "先做原创研究");
    expect(conversationInsert).toBeDefined();
  });

  it("rejects without calling the model when the hourly quota is exhausted", async () => {
    const statement = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ request_count: 20 }),
      all: vi.fn(),
      run: vi.fn(),
    };
    const env = {
      DB: { prepare: vi.fn().mockReturnValue(statement) } as unknown as AppDatabase,
      AI_RUNNER: vi.fn(),
      VOTER_HASH_SECRET: "a".repeat(32),
      ALLOWED_ORIGINS: "https://app.example",
    };

    const response = await handlePostChat(request({ message: "测试" }), env);
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "rate_limited" });
    expect(env.AI_RUNNER).not.toHaveBeenCalled();
    expect(statement.run).not.toHaveBeenCalled();
  });

  it("does not record quota when the generation fails", async () => {
    const statement = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn(),
      run: vi.fn(),
    };
    const env = {
      DB: { prepare: vi.fn().mockReturnValue(statement) } as unknown as AppDatabase,
      AI_RUNNER: vi.fn().mockRejectedValue(new Error("CLI unavailable")),
      VOTER_HASH_SECRET: "a".repeat(32),
      ALLOWED_ORIGINS: "https://app.example",
    };

    const response = await handlePostChat(request({ message: "测试" }), env);
    expect(response.status).toBe(503);
    // 失败不写任何数据：没有限流计数，也没有对话持久化。
    expect(statement.run).not.toHaveBeenCalled();
  });

  it("defaults missing dimensions to neutral instead of failing the turn", async () => {
    const statement = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn(),
      run: vi.fn().mockResolvedValue({ success: true }),
    };
    const env = {
      DB: { prepare: vi.fn().mockReturnValue(statement) } as unknown as AppDatabase,
      AI_RUNNER: vi.fn().mockResolvedValue({
        answer: "先看真正的瓶颈。",
        calibrationSummary: "偏向主线。",
        // 模型漏掉了 restraint 维度
        dimensions: { originality: 1, openness: 1, efficiency: 1, intelligence: 1 },
      }),
      VOTER_HASH_SECRET: "a".repeat(32),
      ALLOWED_ORIGINS: "https://app.example",
    };

    const response = await handlePostChat(request({ message: "先做原创研究" }), env);
    expect(response.status).toBe(200);
    const body = await response.json() as { dimensions: Record<string, number> };
    expect(body.dimensions).toMatchObject({
      originality: 1,
      openness: 1,
      efficiency: 1,
      intelligence: 1,
      restraint: 0,
    });
  });

  it("retries once when the model output is structurally invalid", async () => {
    const statement = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn(),
      run: vi.fn().mockResolvedValue({ success: true }),
    };
    const dimensions = { originality: 0.5, openness: 0.2, efficiency: 0.3, intelligence: 0.4, restraint: 0.2 };
    const env = {
      DB: { prepare: vi.fn().mockReturnValue(statement) } as unknown as AppDatabase,
      AI_RUNNER: vi.fn()
        // 首次输出 answer 为空字符串 → 结构不合法，触发重试
        .mockResolvedValueOnce({ answer: "", calibrationSummary: "x", dimensions })
        .mockResolvedValueOnce({ answer: "先看真正的瓶颈。", calibrationSummary: "y", dimensions }),
      VOTER_HASH_SECRET: "a".repeat(32),
      ALLOWED_ORIGINS: "https://app.example",
    };

    const response = await handlePostChat(request({ message: "测试" }), env);
    expect(response.status).toBe(200);
    const body = await response.json() as { answer: string };
    expect(body.answer).toBe("先看真正的瓶颈。");
    expect(env.AI_RUNNER).toHaveBeenCalledTimes(2);
    const retrySystem = (env.AI_RUNNER as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(retrySystem).toContain("上次输出不符合 schema");
  });

  it("passes a per-request model to the runner", async () => {
    const statement = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn(),
      run: vi.fn().mockResolvedValue({ success: true }),
    };
    const env = {
      DB: { prepare: vi.fn().mockReturnValue(statement) } as unknown as AppDatabase,
      AI_RUNNER: vi.fn().mockResolvedValue({
        answer: "先看真正的瓶颈。",
        calibrationSummary: "偏向主线。",
        dimensions: { originality: 0.5, openness: 0.2, efficiency: 0.3, intelligence: 0.4, restraint: 0.2 },
      }),
      VOTER_HASH_SECRET: "a".repeat(32),
      ALLOWED_ORIGINS: "https://app.example",
    };

    const response = await handlePostChat(
      request({ message: "测试", model: "opencode-go/deepseek-v4-flash" }),
      env,
    );
    expect(response.status).toBe(200);
    expect(env.AI_RUNNER).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(Object),
      { reasoningEffort: "low", model: "opencode-go/deepseek-v4-flash" },
    );
  });

  it("rejects an oversized model override", async () => {
    const env = envWithOpenCode({});
    const response = await handlePostChat(
      request({ message: "测试", model: "x".repeat(121) }),
      env,
    );
    expect(response.status).toBe(400);
    expect(env.AI_RUNNER).not.toHaveBeenCalled();
  });
});
