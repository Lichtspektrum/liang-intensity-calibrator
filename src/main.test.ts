// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const controller = {
    canvas: document.createElement("canvas"),
    slider: document.createElement("input"),
    score: 0,
    setScore: vi.fn(),
    setDisplayScore: vi.fn(),
    setLoading: vi.fn(),
    setFirstFrameReady: vi.fn(),
    setReady: vi.fn(),
    setError: vi.fn(),
    setCommunityUnavailable: vi.fn(),
    setVoteError: vi.fn(),
    restoreVote: vi.fn(),
    setCommunityScore: vi.fn(),
    setUserVotePosition: vi.fn(),
    setTimelineEvents: vi.fn(),
    enterHistoryMode: vi.fn(),
    exitHistoryMode: vi.fn(),
    setNewsLoading: vi.fn(),
    setNewsProgress: vi.fn(),
    setNewsResult: vi.fn(),
    setNewsError: vi.fn(),
    setChatLoading: vi.fn(),
    setChatResult: vi.fn(),
    setChatError: vi.fn(),
    setChatNotice: vi.fn(),
    setChatConversations: vi.fn(),
    setActiveConversationId: vi.fn(),
    setChatThread: vi.fn(),
    clearChatThread: vi.fn(),
    setOpenCodeModels: vi.fn(),
    setSelectedModel: vi.fn(),
    onVote: undefined as ((position: number) => void) | undefined,
    onHistorySelect: undefined as ((date: string) => void) | undefined,
    onHistoryExit: undefined as (() => void) | undefined,
    onModeChange: undefined as ((mode: "manual" | "news" | "chat") => void) | undefined,
    onNewsRefresh: undefined as (() => void) | undefined,
    onChatSubmit: undefined as ((message: string) => void) | undefined,
    onConversationSelect: undefined as ((id: string) => void) | undefined,
    onConversationDelete: undefined as ((id: string) => void) | undefined,
    onNewConversation: undefined as (() => void) | undefined,
    onModelChange: undefined as ((model: string) => void) | undefined,
  };
  return {
    controller,
    mountApp: vi.fn(() => controller),
    drawPoster: vi.fn(async () => undefined),
    loadVideo: vi.fn(async () => undefined),
    render: vi.fn(),
    fetchScore: vi.fn(async () => { throw new Error("unavailable"); }),
    fetchTimeline: vi.fn(async () => []),
    submitVote: vi.fn(),
    configured: false,
  };
});

vi.mock("./app", () => ({ mountApp: mocks.mountApp }));
vi.mock("./video-renderer", async (importOriginal) => {
  const original = await importOriginal<typeof import("./video-renderer")>();
  return {
    ...original,
    createVideoRenderer: vi.fn(() => ({
      drawPoster: mocks.drawPoster,
      loadVideo: mocks.loadVideo,
      render: mocks.render,
      redraw: vi.fn(),
    })),
  };
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
      startNewsCollection: vi.fn(),
      fetchNewsProgress: vi.fn(),
      chat: vi.fn(),
      fetchConversations: vi.fn(async () => []),
      fetchConversation: vi.fn(),
      deleteConversation: vi.fn(),
      fetchOpenCodeModels: vi.fn(async () => ({
        models: [],
        active: "opencode/deepseek-v4-flash-free",
        activeInList: true,
      })),
    })),
  };
});

describe("client bootstrap", () => {
  beforeEach(() => {
    document.body.innerHTML = '<main id="app"></main>';
    localStorage.clear();
    vi.clearAllMocks();
    vi.resetModules();
    mocks.configured = false;
    mocks.controller.score = 0;
    mocks.fetchScore.mockRejectedValue(new Error("unavailable"));
    mocks.fetchTimeline.mockResolvedValue([]);
  });

  it("mounts and loads media even when the local API is unavailable", async () => {
    await import("./main");
    await vi.waitFor(() => expect(mocks.controller.setReady).toHaveBeenCalledOnce());

    expect(mocks.mountApp).toHaveBeenCalledOnce();
    expect(mocks.controller.setCommunityUnavailable).toHaveBeenCalledOnce();
    expect(mocks.loadVideo).toHaveBeenCalledOnce();
  });

  it("parses the locally saved manual position safely", async () => {
    const { parseStoredVote } = await import("./main");

    expect(parseStoredVote('{"position":6,"nextVoteAt":0}')).toEqual({
      position: 6,
      nextVoteAt: 0,
    });
    expect(parseStoredVote('{"position":99,"nextVoteAt":0}')).toBeNull();
    expect(parseStoredVote("not json")).toBeNull();
  });

  it("saves manual calibration locally without sending an online ballot", async () => {
    mocks.configured = true;
    await import("./main");

    mocks.controller.onVote?.(9);

    expect(localStorage.getItem("liang-slider:manual-position:v1")).toBe(
      JSON.stringify({ position: 9, nextVoteAt: 0 }),
    );
    expect(mocks.controller.setUserVotePosition).toHaveBeenCalledWith(9);
    expect(mocks.controller.restoreVote).toHaveBeenCalledWith(9);
    expect(mocks.submitVote).not.toHaveBeenCalled();
  });

  it("restores the last local manual position immediately", async () => {
    localStorage.setItem(
      "liang-slider:manual-position:v1",
      JSON.stringify({ position: -4, nextVoteAt: 0 }),
    );

    await import("./main");

    expect(mocks.controller.setUserVotePosition).toHaveBeenCalledWith(-4);
    expect(mocks.controller.restoreVote).toHaveBeenCalledWith(-4);
  });
});
