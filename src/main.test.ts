// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ScoreData, TimelineDayData, VoteResult } from "./api";

const mocks = vi.hoisted(() => {
  const canvas = document.createElement("canvas");
  const controller = {
    canvas,
    slider: document.createElement("input"),
    score: 0,
    setScore: vi.fn(),
    setDisplayScore: vi.fn(),
    setLoading: vi.fn(),
    setFirstFrameReady: vi.fn(),
    setReady: vi.fn(),
    setError: vi.fn(),
    setCommunityUnavailable: vi.fn(),
    setCooldown: vi.fn(),
    setVoteError: vi.fn(),
    restoreVote: vi.fn(),
    setCommunityScore: vi.fn<(score: ScoreData) => void>(),
    setUserVotePosition: vi.fn(),
    setVotingState: vi.fn(),
    setTimelineEvents: vi.fn(),
    enterHistoryMode: vi.fn(),
    exitHistoryMode: vi.fn(),
    onVote: undefined as ((position: number) => void) | undefined,
    onHistorySelect: undefined as ((date: string) => void) | undefined,
    onHistoryExit: undefined as (() => void) | undefined,
  };
  return {
    controller,
    mountApp: vi.fn((
      _root: HTMLElement,
      _onScoreChange?: (score: number) => void,
      _poster?: HTMLImageElement,
    ) => controller),
    drawPoster: vi.fn<() => Promise<void>>(async () => undefined),
    loadVideo: vi.fn<() => Promise<void>>(async () => undefined),
    render: vi.fn(),
    createVideoRenderer: vi.fn(),
    configured: false,
    fetchScore: vi.fn<() => Promise<ScoreData>>(async () => { throw new Error("unavailable"); }),
    fetchTimeline: vi.fn<() => Promise<TimelineDayData[]>>(async () => {
      throw new Error("unavailable");
    }),
    submitVote: vi.fn<(fingerprint: string, position: number) => Promise<VoteResult>>(),
    fingerprintLoad: vi.fn(async () => ({
      get: vi.fn(async () => ({ visitorId: "visitor-123" })),
    })),
  };
});

mocks.createVideoRenderer.mockReturnValue({
  drawPoster: mocks.drawPoster,
  loadVideo: mocks.loadVideo,
  render: mocks.render,
  redraw: vi.fn(),
});

vi.mock("./app", () => ({ mountApp: mocks.mountApp }));
vi.mock("@fingerprintjs/fingerprintjs", () => ({
  default: { load: mocks.fingerprintLoad },
}));
vi.mock("./video-renderer", async (importOriginal) => {
  const original = await importOriginal<typeof import("./video-renderer")>();
  return { ...original, createVideoRenderer: mocks.createVideoRenderer };
});
vi.mock("./api", async (importOriginal) => {
  const original = await importOriginal<typeof import("./api")>();
  return {
    ...original,
    createApiClient: vi.fn(() => ({
      configured: mocks.configured,
      fetchScore: mocks.fetchScore,
      fetchTimeline: mocks.fetchTimeline,
      submitVote: mocks.submitVote,
    })),
  };
});

describe("static Pages bootstrap", () => {
  beforeEach(() => {
    document.body.innerHTML = '<main id="app"></main>';
    localStorage.clear();
    vi.clearAllMocks();
    vi.resetModules();
    mocks.configured = false;
    mocks.controller.score = 0;
    mocks.controller.setCommunityScore.mockImplementation((score) => {
      mocks.controller.score = score.score;
    });
    mocks.controller.restoreVote.mockImplementation((position) => {
      mocks.controller.score = position;
    });
    mocks.drawPoster.mockResolvedValue(undefined);
    mocks.loadVideo.mockResolvedValue(undefined);
    mocks.fetchScore.mockRejectedValue(new Error("unavailable"));
    mocks.fetchTimeline.mockRejectedValue(new Error("unavailable"));
    mocks.submitVote.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("无需 SSR 状态即可挂载，并在 API 不可用时继续加载视频", async () => {
    await import("./main");
    await vi.waitFor(() => expect(mocks.controller.setReady).toHaveBeenCalledOnce());

    const poster = mocks.mountApp.mock.calls[0]?.[2] as HTMLImageElement;
    expect(poster).toBeInstanceOf(HTMLImageElement);
    expect(poster.className).toBe("ssr-poster");
    expect(poster.getAttribute("src")).toBe("/frames/frame-15.webp");
    expect(mocks.controller.setCommunityUnavailable).toHaveBeenCalledOnce();
    expect(mocks.controller.setError).not.toHaveBeenCalled();
    expect(mocks.loadVideo).toHaveBeenCalledOnce();
    expect(mocks.render).toHaveBeenCalledWith(mocks.controller.score);
  });

  it("安全解析固定 key 下的持久投票", async () => {
    const { parseStoredVote } = await import("./main");

    expect(parseStoredVote('{"position":6,"nextVoteAt":123}')).toEqual({
      position: 6,
      nextVoteAt: 123,
    });
    expect(parseStoredVote('{"position":99,"nextVoteAt":123}')).toBeNull();
    expect(parseStoredVote("not json")).toBeNull();
  });

  it("已配置客户端先应用社区数据，媒体稍后就绪，并持久化成功投票", async () => {
    let releasePoster!: () => void;
    mocks.drawPoster.mockImplementation(() => new Promise<void>((resolve) => {
      releasePoster = resolve;
    }));
    mocks.configured = true;
    const score = {
      score: 2.5,
      stage: "梁圣",
      voterCount: 4,
      todayVoterCount: 2,
      positiveCount: 3,
      negativeCount: 1,
      neutralCount: 0,
      positivePoints: 13,
      negativePoints: -3,
    };
    mocks.fetchScore.mockResolvedValue(score);
    mocks.fetchTimeline.mockResolvedValue([
      { date: "2026-08-13", score: 2.5, stage: "梁圣", voterCount: 4 },
    ]);
    mocks.submitVote.mockResolvedValue({
      ...score,
      accepted: true,
      userPosition: 6,
      nextVoteAt: 999,
    });

    await import("./main");
    await vi.waitFor(() => expect(mocks.controller.setCommunityScore).toHaveBeenCalledWith(score));
    expect(mocks.controller.setTimelineEvents).toHaveBeenCalledWith([
      expect.objectContaining({ date: "2026-08-13", title: "梁圣 · 4 人" }),
    ]);
    expect(mocks.controller.setReady).not.toHaveBeenCalled();

    releasePoster();
    await vi.waitFor(() => expect(mocks.controller.setReady).toHaveBeenCalledOnce());
    expect(mocks.render).toHaveBeenLastCalledWith(2.5);
    await mocks.controller.onVote?.(6);

    expect(localStorage.getItem("liang-slider:vote:v3")).toBe(
      JSON.stringify({ position: 6, nextVoteAt: 999 }),
    );
    expect(mocks.controller.setUserVotePosition).toHaveBeenCalledWith(6);
    expect(mocks.controller.restoreVote).toHaveBeenCalledWith(6);
    expect(mocks.controller.setCooldown).toHaveBeenCalled();
  });

  it("本地记录仍在冷却时只恢复预览，不请求指纹或提交", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-14T00:00:00.000Z"));
    localStorage.setItem("liang-slider:vote:v3", JSON.stringify({
      position: 6,
      nextVoteAt: Date.now() + 60_000,
    }));
    mocks.configured = true;
    mocks.fetchScore.mockResolvedValue({
      score: 2.5, stage: "梁圣", voterCount: 4, todayVoterCount: 2,
      positiveCount: 3, negativeCount: 1, neutralCount: 0,
      positivePoints: 13, negativePoints: -3,
    });

    await import("./main");
    await Promise.resolve();
    await mocks.controller.onVote?.(11);

    expect(mocks.controller.restoreVote).toHaveBeenLastCalledWith(6);
    expect(mocks.controller.setCooldown).toHaveBeenLastCalledWith(60_000, true);
    expect(mocks.submitVote).not.toHaveBeenCalled();
    expect(mocks.fingerprintLoad).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.controller.setCooldown).toHaveBeenLastCalledWith(0);
  });

  it("提交抛错时保留本地记录的原始字节并恢复旧位置", async () => {
    const raw = '{"position":-4,"nextVoteAt":0, "untouched":true}';
    localStorage.setItem("liang-slider:vote:v3", raw);
    mocks.configured = true;
    mocks.fetchScore.mockResolvedValue({
      score: 2.5, stage: "梁圣", voterCount: 4, todayVoterCount: 2,
      positiveCount: 3, negativeCount: 1, neutralCount: 0,
      positivePoints: 13, negativePoints: -3,
    });
    mocks.submitVote.mockRejectedValue(new Error("network"));

    await import("./main");
    await mocks.controller.onVote?.(12);

    expect(localStorage.getItem("liang-slider:vote:v3")).toBe(raw);
    expect(mocks.controller.restoreVote).toHaveBeenLastCalledWith(-4);
    expect(mocks.controller.setVoteError).toHaveBeenCalledOnce();
  });

  it("服务端冷却响应恢复服务端投票位置且不写本地记录", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-14T00:00:00.000Z"));
    const raw = JSON.stringify({ position: -4, nextVoteAt: 0 });
    localStorage.setItem("liang-slider:vote:v3", raw);
    mocks.configured = true;
    const community = {
      score: 3, stage: "梁圣", voterCount: 5, todayVoterCount: 1,
      positiveCount: 4, negativeCount: 1, neutralCount: 0,
      positivePoints: 18, negativePoints: -3,
    } as const;
    mocks.fetchScore.mockResolvedValue(community);
    mocks.submitVote.mockResolvedValue({
      ...community,
      accepted: false,
      reason: "cooldown",
      userPosition: 7,
      nextVoteAt: Date.now() + 90_000,
    });

    await import("./main");
    await mocks.controller.onVote?.(12);

    expect(localStorage.getItem("liang-slider:vote:v3")).toBe(raw);
    expect(mocks.controller.setCommunityScore).toHaveBeenLastCalledWith(
      expect.objectContaining({ score: 3 }),
    );
    expect(mocks.controller.setUserVotePosition).toHaveBeenLastCalledWith(7);
    expect(mocks.controller.restoreVote).toHaveBeenLastCalledWith(7);
    expect(mocks.controller.setCooldown).toHaveBeenLastCalledWith(90_000, true);
    await mocks.controller.onVote?.(-12);
    expect(mocks.submitVote).toHaveBeenCalledTimes(1);
    expect(mocks.fingerprintLoad).toHaveBeenCalledTimes(1);
    expect(mocks.controller.restoreVote).toHaveBeenLastCalledWith(7);
    expect(mocks.controller.setCooldown).toHaveBeenLastCalledWith(90_000, true);
    expect(localStorage.getItem("liang-slider:vote:v3")).toBe(raw);
  });

  it("新身份被限流时恢复后备位置并显示提交错误", async () => {
    mocks.configured = true;
    const community = {
      score: 3, stage: "梁圣", voterCount: 5, todayVoterCount: 1,
      positiveCount: 4, negativeCount: 1, neutralCount: 0,
      positivePoints: 18, negativePoints: -3,
    } as const;
    mocks.fetchScore.mockResolvedValue(community);
    mocks.submitVote.mockResolvedValue({
      ...community,
      accepted: false,
      reason: "rate_limited",
      userPosition: 7,
      nextVoteAt: null,
    });

    await import("./main");
    await vi.waitFor(() => expect(mocks.controller.setCommunityScore).toHaveBeenCalled());
    await mocks.controller.onVote?.(12);

    expect(localStorage.getItem("liang-slider:vote:v3")).toBeNull();
    expect(mocks.controller.restoreVote).toHaveBeenLastCalledWith(3);
    expect(mocks.controller.setVoteError).toHaveBeenCalledOnce();
  });

  it("初始社区分数加载后把红点恢复到已保存的个人票", async () => {
    localStorage.setItem("liang-slider:vote:v3", JSON.stringify({ position: 6, nextVoteAt: 0 }));
    mocks.configured = true;
    mocks.fetchScore.mockResolvedValue({
      score: 2.5, stage: "梁圣", voterCount: 4, todayVoterCount: 2,
      positiveCount: 3, negativeCount: 1, neutralCount: 0,
      positivePoints: 13, negativePoints: -3,
    });

    await import("./main");
    await vi.waitFor(() => expect(mocks.controller.setCommunityScore).toHaveBeenCalled());

    expect(mocks.controller.setUserVotePosition).toHaveBeenCalledWith(6);
    expect(mocks.controller.restoreVote).toHaveBeenCalledWith(6);
  });

  it("不等社区请求完成就恢复本地投票和冷却", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-14T00:00:00.000Z"));
    localStorage.setItem("liang-slider:vote:v3", JSON.stringify({
      position: 6,
      nextVoteAt: Date.now() + 2 * 60 * 60_000 + 18 * 60_000,
    }));
    mocks.configured = true;
    mocks.fetchScore.mockImplementation(() => new Promise(() => undefined));

    await import("./main");

    expect(mocks.controller.setUserVotePosition).toHaveBeenCalledWith(6);
    expect(mocks.controller.restoreVote).toHaveBeenCalledWith(6);
    expect(mocks.controller.setCooldown).toHaveBeenLastCalledWith(8_280_000);
    expect(mocks.drawPoster).toHaveBeenCalledWith(expect.any(HTMLImageElement), 6);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.controller.setCooldown).toHaveBeenLastCalledWith(8_220_000);
    await vi.advanceTimersByTimeAsync(59 * 60_000);
    expect(mocks.controller.setCooldown).toHaveBeenLastCalledWith(4_680_000);
  });

  it("页面重新可见时按当前时间校准冷却", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-14T00:00:00.000Z"));
    localStorage.setItem("liang-slider:vote:v3", JSON.stringify({
      position: 6,
      nextVoteAt: Date.now() + 2 * 60 * 60_000,
    }));
    await import("./main");

    vi.setSystemTime(new Date("2026-08-14T01:30:00.000Z"));
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(mocks.controller.setCooldown).toHaveBeenLastCalledWith(30 * 60_000);
    visibility.mockRestore();
  });

  it("新的提交错误会取消旧冷却计时器", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-14T00:00:00.000Z"));
    mocks.configured = true;
    mocks.fetchScore.mockResolvedValue({
      score: 3, stage: "梁圣", voterCount: 5, todayVoterCount: 1,
      positiveCount: 4, negativeCount: 1, neutralCount: 0,
      positivePoints: 18, negativePoints: -3,
    });
    mocks.submitVote
      .mockResolvedValueOnce({
        score: 6, stage: "梁圣", voterCount: 5, todayVoterCount: 1,
        positiveCount: 4, negativeCount: 1, neutralCount: 0,
        positivePoints: 33, negativePoints: -3,
        accepted: true, userPosition: 6, nextVoteAt: Date.now() + 60_000,
      })
      .mockRejectedValueOnce(new Error("network"));

    await import("./main");
    await mocks.controller.onVote?.(6);
    localStorage.setItem("liang-slider:vote:v3", JSON.stringify({ position: 6, nextVoteAt: 0 }));
    await mocks.controller.onVote?.(8);
    const cooldownCalls = mocks.controller.setCooldown.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);

    expect(mocks.controller.setVoteError).toHaveBeenCalledOnce();
    expect(mocks.controller.setCooldown).toHaveBeenCalledTimes(cooldownCalls);
  });

  it("指纹或 POST 在途时忽略第二次提交并恢复权威位置", async () => {
    let resolveVote!: (result: VoteResult) => void;
    mocks.configured = true;
    const score = {
      score: 3, stage: "梁圣", voterCount: 5, todayVoterCount: 1,
      positiveCount: 4, negativeCount: 1, neutralCount: 0,
      positivePoints: 18, negativePoints: -3,
    } as const;
    mocks.fetchScore.mockResolvedValue(score);
    mocks.submitVote
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveVote = resolve;
      }))
      .mockResolvedValueOnce({
        ...score,
        accepted: true,
        userPosition: 4,
        nextVoteAt: 999,
      });

    await import("./main");
    await vi.waitFor(() => expect(mocks.controller.setCommunityScore).toHaveBeenCalled());
    const firstVote = mocks.controller.onVote?.(8);
    await vi.waitFor(() => expect(mocks.submitVote).toHaveBeenCalledOnce());
    await mocks.controller.onVote?.(-8);

    expect(mocks.submitVote).toHaveBeenCalledOnce();
    expect(mocks.fingerprintLoad).toHaveBeenCalledOnce();
    expect(mocks.controller.restoreVote).toHaveBeenLastCalledWith(3);
    resolveVote({ ...score, accepted: true, userPosition: 8, nextVoteAt: 999 });
    await firstVote;
    await mocks.controller.onVote?.(4);
    expect(mocks.submitVote).toHaveBeenCalledTimes(2);
  });

  it("本地冷却不会使较慢的社区分数失效", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-14T00:00:00.000Z"));
    let resolveScore!: (score: ScoreData) => void;
    localStorage.setItem("liang-slider:vote:v3", JSON.stringify({
      position: 6,
      nextVoteAt: Date.now() + 60_000,
    }));
    mocks.configured = true;
    mocks.fetchScore.mockImplementation(() => new Promise((resolve) => {
      resolveScore = resolve;
    }));

    await import("./main");
    await mocks.controller.onVote?.(10);
    resolveScore({
      score: 2.5, stage: "梁圣", voterCount: 4, todayVoterCount: 2,
      positiveCount: 3, negativeCount: 1, neutralCount: 0,
      positivePoints: 13, negativePoints: -3,
    });
    await Promise.resolve();

    expect(mocks.controller.setCommunityScore).toHaveBeenCalledWith(
      expect.objectContaining({ score: 2.5 }),
    );
    expect(mocks.controller.restoreVote).toHaveBeenLastCalledWith(6);
  });

  it("忽略比成功提交更旧的启动分数响应", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-14T00:00:00.000Z"));
    let resolveScore!: (score: ScoreData) => void;
    mocks.configured = true;
    mocks.fetchScore.mockImplementation(() => new Promise((resolve) => {
      resolveScore = resolve;
    }));
    const voteScore = {
      score: 6, stage: "梁圣", voterCount: 5, todayVoterCount: 1,
      positiveCount: 4, negativeCount: 1, neutralCount: 0,
      positivePoints: 33, negativePoints: -3,
    } as const;
    mocks.submitVote.mockResolvedValue({
      ...voteScore,
      accepted: true,
      userPosition: 6,
      nextVoteAt: Date.now() + 60_000,
    });

    await import("./main");
    await mocks.controller.onVote?.(6);
    resolveScore({
      score: 2.5, stage: "梁圣", voterCount: 4, todayVoterCount: 2,
      positiveCount: 3, negativeCount: 1, neutralCount: 0,
      positivePoints: 13, negativePoints: -3,
    });
    await Promise.resolve();

    expect(mocks.controller.setCommunityScore).toHaveBeenCalledTimes(1);
    expect(mocks.controller.setCommunityScore).toHaveBeenLastCalledWith(
      expect.objectContaining({ score: 6 }),
    );
    expect(mocks.controller.restoreVote).toHaveBeenLastCalledWith(6);
  });

  it("忽略比成功提交更旧的启动分数失败", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-14T00:00:00.000Z"));
    let rejectScore!: (error: Error) => void;
    mocks.configured = true;
    mocks.fetchScore.mockImplementation(() => new Promise((_resolve, reject) => {
      rejectScore = reject;
    }));
    const voteScore = {
      score: 6, stage: "梁圣", voterCount: 5, todayVoterCount: 1,
      positiveCount: 4, negativeCount: 1, neutralCount: 0,
      positivePoints: 33, negativePoints: -3,
    } as const;
    mocks.submitVote.mockResolvedValue({
      ...voteScore,
      accepted: true,
      userPosition: 6,
      nextVoteAt: Date.now() + 60_000,
    });

    await import("./main");
    await mocks.controller.onVote?.(6);
    rejectScore(new Error("stale failure"));
    await Promise.resolve();

    expect(mocks.controller.setCommunityUnavailable).not.toHaveBeenCalled();
    expect(mocks.controller.setCommunityScore).toHaveBeenLastCalledWith(
      expect.objectContaining({ score: 6 }),
    );
  });

  it("提交抛错后仍接收较慢的社区分数", async () => {
    let resolveScore!: (score: ScoreData) => void;
    mocks.configured = true;
    mocks.fetchScore.mockImplementation(() => new Promise((resolve) => {
      resolveScore = resolve;
    }));
    mocks.submitVote.mockRejectedValue(new Error("network"));

    await import("./main");
    await mocks.controller.onVote?.(8);
    resolveScore({
      score: 2.5, stage: "梁圣", voterCount: 4, todayVoterCount: 2,
      positiveCount: 3, negativeCount: 1, neutralCount: 0,
      positivePoints: 13, negativePoints: -3,
    });
    await Promise.resolve();

    expect(mocks.controller.setVoteError).toHaveBeenCalledOnce();
    expect(mocks.controller.restoreVote).toHaveBeenLastCalledWith(0);
    expect(mocks.controller.setCommunityScore).toHaveBeenCalledWith(
      expect.objectContaining({ score: 2.5 }),
    );
  });

  it("校验失败后仍处理较慢的社区分数失败", async () => {
    let rejectScore!: (error: Error) => void;
    mocks.configured = true;
    mocks.fetchScore.mockImplementation(() => new Promise((_resolve, reject) => {
      rejectScore = reject;
    }));
    mocks.submitVote.mockResolvedValue({ accepted: false, reason: "csrf" });

    await import("./main");
    await mocks.controller.onVote?.(8);
    rejectScore(new Error("stale failure"));
    await Promise.resolve();

    expect(mocks.controller.setVoteError).toHaveBeenCalledOnce();
    expect(mocks.controller.restoreVote).toHaveBeenLastCalledWith(0);
    expect(mocks.controller.setCommunityUnavailable).toHaveBeenCalledOnce();
  });
});
