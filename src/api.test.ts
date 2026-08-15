import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatRateLimitError, CommunityUnavailableError, createApiClient } from "./api";

const score = {
  score: 2.5,
  stage: "梁圣",
  voterCount: 4,
  positiveCount: 3,
  negativeCount: 1,
  neutralCount: 0,
  positivePoints: 13,
  negativePoints: -3,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createApiClient", () => {
  it("用规范化后的独立 API 绝对地址读取分数和历史快照", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(score)))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { date: "2026-08-13", score: 2.5, stage: "梁圣", voterCount: 4 },
      ])));
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient("https://liang-api.example.com///");

    await expect(client.fetchScore()).resolves.toEqual(score);
    await expect(client.fetchTimeline("2026-08-01", "2026-08-14")).resolves.toHaveLength(1);
    expect(client.configured).toBe(true);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://liang-api.example.com/api/score");
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://liang-api.example.com/api/timeline?from=2026-08-01&to=2026-08-14",
    );
  });

  it("向独立 API 提交 JSON 投票", async () => {
    const result = { ...score, accepted: true, userPosition: 6, nextVoteAt: 123 };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(result), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = createApiClient("https://liang-api.example.com/");
    await expect(client.submitVote("fingerprint-123", 6)).resolves.toEqual(result);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://liang-api.example.com/api/vote");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint: "fingerprint-123", position: 6 }),
    });
  });

  it("保留 429 冷却和限流响应里的结构化信息", async () => {
    const cooldown = {
      ...score,
      accepted: false,
      reason: "cooldown",
      userPosition: 3,
      nextVoteAt: 456,
    };
    const rateLimited = {
      ...score,
      accepted: false,
      reason: "rate_limited",
      userPosition: 3,
      nextVoteAt: null,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(cooldown), { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(rateLimited), { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient("https://liang-api.example.com");

    await expect(client.submitVote("fingerprint-123", 3)).resolves.toEqual(cooldown);
    await expect(client.submitVote("fingerprint-123", 3)).resolves.toEqual(rateLimited);
  });

  it("未配置地址时保持零网络请求并给出明确状态", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient("  ");

    expect(client.configured).toBe(false);
    await expect(client.fetchScore()).rejects.toBeInstanceOf(CommunityUnavailableError);
    await expect(client.fetchTimeline()).rejects.toBeInstanceOf(CommunityUnavailableError);
    await expect(client.submitVote("fingerprint-123", 3)).rejects.toBeInstanceOf(
      CommunityUnavailableError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("拒绝带凭据、查询、哈希或非根路径的 API 地址", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const invalidBases = [
      "https://user:pass@liang-api.example.com",
      "https://liang-api.example.com?tenant=evil",
      "https://liang-api.example.com#evil",
      "https://liang-api.example.com/proxy",
    ];

    for (const base of invalidBases) {
      const client = createApiClient(base);
      expect(client.configured).toBe(false);
      await expect(client.fetchScore()).rejects.toBeInstanceOf(CommunityUnavailableError);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("拒绝越界、非有限或内部不一致的社区分数", async () => {
    const invalidScores = [
      { ...score, score: 16 },
      { ...score, stage: "<img src=x>" },
      { ...score, voterCount: 4.5 },
      { ...score, positiveCount: 4 },
      { ...score, positivePoints: 46 },
      { ...score, negativePoints: 1 },
      { ...score, positivePoints: 1.5 },
      {
        score: 15,
        stage: "梁祖",
        voterCount: 1,
        positiveCount: 1,
        negativeCount: 0,
        neutralCount: 0,
        positivePoints: 1,
        negativePoints: 0,
      },
      {
        score: 1,
        stage: "梁子",
        voterCount: 0,
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0,
        positivePoints: 0,
        negativePoints: 0,
      },
    ];
    const infiniteScore = JSON.stringify(score).replace('"score":2.5', '"score":1e999');
    const fetchMock = vi.fn();
    invalidScores.forEach((value) => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(value)));
    });
    fetchMock.mockResolvedValueOnce(new Response(infiniteScore));
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient("https://liang-api.example.com");

    for (let index = 0; index < invalidScores.length + 1; index += 1) {
      await expect(client.fetchScore()).rejects.toThrow("Invalid score response");
    }
  });

  it("接受合法的零投票社区状态", async () => {
    const empty = {
      score: 0,
      stage: "梁子",
      voterCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      positivePoints: 0,
      negativePoints: 0,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(empty))));

    await expect(createApiClient("https://liang-api.example.com").fetchScore())
      .resolves.toEqual(empty);
  });

  it("接受由正负票和中立票算出的平均分与百分位中点", async () => {
    const midpoint = {
      score: 0.5,
      stage: "梁子",
      voterCount: 2,
      positiveCount: 1,
      negativeCount: 0,
      neutralCount: 1,
      positivePoints: 1,
      negativePoints: 0,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(score)))
      .mockResolvedValueOnce(new Response(JSON.stringify(midpoint)));
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient("https://liang-api.example.com");

    await expect(client.fetchScore()).resolves.toEqual(score);
    await expect(client.fetchScore()).resolves.toEqual(midpoint);
  });

  it("拒绝无效快照日期、分值和阶段", async () => {
    const invalidDays = [
      [{ date: "2026-02-30", score: 2.5, stage: "梁圣", voterCount: 4 }],
      [{ date: '<img src=x onerror=alert(1)>', score: 2.5, stage: "梁圣", voterCount: 4 }],
      [{ date: "2026-08-13", score: 99, stage: "梁祖", voterCount: 4 }],
      [{ date: "2026-08-13", score: 2.5, stage: "梁祖", voterCount: 4 }],
      [{ date: "2026-08-13", score: 2.5, stage: "梁圣", voterCount: -1 }],
    ];
    const fetchMock = vi.fn();
    invalidDays.forEach((value) => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(value)));
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient("https://liang-api.example.com");

    for (const _ of invalidDays) {
      await expect(client.fetchTimeline()).rejects.toThrow("Invalid timeline response");
    }
  });

  it("拒绝 5xx 和不符合合同的响应", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("upstream down", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "nope" }), { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ score: "2.5" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        accepted: true,
        userPosition: 3,
        nextVoteAt: 123,
      })));
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient("https://liang-api.example.com");

    await expect(client.fetchScore()).rejects.toThrow("API error: 503");
    await expect(client.submitVote("fingerprint-123", 3)).rejects.toThrow(
      "Invalid vote response",
    );
    await expect(client.fetchScore()).rejects.toThrow("Invalid score response");
    await expect(client.submitVote("fingerprint-123", 3)).rejects.toThrow(
      "Invalid vote response",
    );
  });

  it("严格匹配投票响应的 HTTP 状态与判别字段", async () => {
    const accepted = { ...score, accepted: true, userPosition: 3, nextVoteAt: 123 };
    const cooldown = {
      ...score,
      accepted: false,
      reason: "cooldown",
      userPosition: 3,
      nextVoteAt: 456,
    };
    const csrf = { accepted: false, reason: "csrf" };
    const unavailable = { accepted: false, reason: "service_unavailable" };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(accepted), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(accepted), { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(cooldown), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(csrf), { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(cooldown), { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(unavailable), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(accepted), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(unavailable), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient("https://liang-api.example.com");
    const submit = () => client.submitVote("fingerprint-123", 3);

    await expect(submit()).rejects.toThrow("Invalid vote response");
    await expect(submit()).rejects.toThrow("Invalid vote response");
    await expect(submit()).rejects.toThrow("Invalid vote response");
    await expect(submit()).resolves.toEqual(csrf);
    await expect(submit()).rejects.toThrow("Invalid vote response");
    await expect(submit()).rejects.toThrow("API error: 503");
    await expect(submit()).rejects.toThrow("API error: 503");
    await expect(submit()).rejects.toThrow("Invalid vote response");
  });

  it("拒绝投票中的小数位置和无效下次投票时间", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ...score,
        accepted: true,
        userPosition: 3.5,
        nextVoteAt: 123,
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ...score,
        accepted: true,
        userPosition: 3,
        nextVoteAt: -1,
      })));
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient("https://liang-api.example.com");

    await expect(client.submitVote("fingerprint-123", 3)).rejects.toThrow(
      "Invalid vote response",
    );
    await expect(client.submitVote("fingerprint-123", 3)).rejects.toThrow(
      "Invalid vote response",
    );
  });

  it("把对话限流的 429 区分成独立错误类型", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient("https://liang-api.example.com");

    await expect(client.chat("你好")).rejects.toBeInstanceOf(ChatRateLimitError);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({ message: "你好" });
  });

  it("发送对话时携带 conversationId 且校验返回的对话信息", async () => {
    const chatBody = {
      score: 6,
      stage: "梁圣",
      answer: "先看真正的瓶颈。",
      calibrationSummary: "偏向主线。",
      dimensions: { originality: 0.4, openness: 0.2, efficiency: 0.2, intelligence: 0.6, restraint: 0.2 },
      disclaimer: "simulation",
      conversation: { id: "00000000-0000-4000-8000-000000000001", title: "先做原创研究" },
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(chatBody)));
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient("https://liang-api.example.com");

    await expect(
      client.chat("下一步呢？", undefined, "00000000-0000-4000-8000-000000000001"),
    ).resolves.toEqual(chatBody);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({
      message: "下一步呢？",
      conversationId: "00000000-0000-4000-8000-000000000001",
    });
    expect(body.history).toBeUndefined();
  });

  it("拒绝缺少 conversation 字段的对话响应", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      score: 6,
      stage: "梁圣",
      answer: "答",
      calibrationSummary: "总",
      dimensions: { originality: 0, openness: 0, efficiency: 0, intelligence: 0, restraint: 0 },
      disclaimer: "d",
    })));
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient("https://liang-api.example.com");

    await expect(client.chat("你好")).rejects.toThrow("Invalid chat response");
  });

  it("把选中的模型随对话请求发送", async () => {
    const chatBody = {
      score: 6,
      stage: "梁圣",
      answer: "答",
      calibrationSummary: "总",
      dimensions: { originality: 0, openness: 0, efficiency: 0, intelligence: 0, restraint: 0 },
      disclaimer: "d",
      conversation: { id: "00000000-0000-4000-8000-000000000001", title: "t" },
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(chatBody)));
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient("https://liang-api.example.com");

    await client.chat("你好", undefined, undefined, "opencode-go/deepseek-v4-flash");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({ message: "你好", model: "opencode-go/deepseek-v4-flash" });
  });

  it("读取自动发现的 opencode 模型列表", async () => {
    const body = { models: ["a", "b"], active: "a", activeInList: true };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient("https://liang-api.example.com");

    await expect(client.fetchOpenCodeModels()).resolves.toEqual(body);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://liang-api.example.com/api/opencode-models");
  });
});
