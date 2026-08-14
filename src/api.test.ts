import { afterEach, describe, expect, it, vi } from "vitest";

import { CommunityUnavailableError, createApiClient } from "./api";

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
  it("用规范化后的独立 API 绝对地址读取分数和时间线", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(score)))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { date: "2026-08-13", score: 2.5, stage: "梁圣", voterCount: 4 },
      ])));
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient("https://liang-api.example.workers.dev///");

    await expect(client.fetchScore()).resolves.toEqual(score);
    await expect(client.fetchTimeline("2026-08-01", "2026-08-14")).resolves.toHaveLength(1);
    expect(client.configured).toBe(true);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://liang-api.example.workers.dev/api/score");
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://liang-api.example.workers.dev/api/timeline?from=2026-08-01&to=2026-08-14",
    );
  });

  it("向独立 API 提交 JSON 投票", async () => {
    const result = { ...score, accepted: true, userPosition: 6, nextVoteAt: 123 };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(result), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = createApiClient("https://liang-api.example.workers.dev/");
    await expect(client.submitVote("fingerprint-123", 6)).resolves.toEqual(result);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://liang-api.example.workers.dev/api/vote");
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
    const client = createApiClient("https://liang-api.example.workers.dev");

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
      "https://user:pass@liang-api.example.workers.dev",
      "https://liang-api.example.workers.dev?tenant=evil",
      "https://liang-api.example.workers.dev#evil",
      "https://liang-api.example.workers.dev/proxy",
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
    const client = createApiClient("https://liang-api.example.workers.dev");

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

    await expect(createApiClient("https://liang-api.example.workers.dev").fetchScore())
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
    const client = createApiClient("https://liang-api.example.workers.dev");

    await expect(client.fetchScore()).resolves.toEqual(score);
    await expect(client.fetchScore()).resolves.toEqual(midpoint);
  });

  it("拒绝无效时间线日期、分值和阶段", async () => {
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
    const client = createApiClient("https://liang-api.example.workers.dev");

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
    const client = createApiClient("https://liang-api.example.workers.dev");

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
    const client = createApiClient("https://liang-api.example.workers.dev");
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
    const client = createApiClient("https://liang-api.example.workers.dev");

    await expect(client.submitVote("fingerprint-123", 3)).rejects.toThrow(
      "Invalid vote response",
    );
    await expect(client.submitVote("fingerprint-123", 3)).rejects.toThrow(
      "Invalid vote response",
    );
  });
});
