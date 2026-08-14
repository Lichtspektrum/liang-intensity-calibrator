// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { mountApp } from "./app";

describe("liang slider app", () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<main id="app"></main>';
    root = document.querySelector<HTMLElement>("#app")!;
  });

  it("挂载客户端界面时保留服务端首帧节点", () => {
    const poster = document.createElement("img");
    poster.className = "ssr-poster";
    root.append(poster);

    mountApp(root, undefined, poster);

    expect(root.querySelector(".portrait-shell > .ssr-poster")).toBe(poster);
  });

  it("渲染 -15 到 15 的连续预览滑杆和 31 个语义刻度", () => {
    mountApp(root);

    const slider = root.querySelector<HTMLInputElement>("#strength-slider")!;
    expect(slider.min).toBe("-15");
    expect(slider.max).toBe("15");
    expect(slider.step).toBe("0.01");
    expect(root.querySelectorAll(".tick")).toHaveLength(31);
  });

  it("保留连续滑动位置并用最近等级更新文字", () => {
    const positions: number[] = [];
    const controller = mountApp(root, (position) => positions.push(position));

    controller.setScore(3.35);

    const slider = root.querySelector<HTMLInputElement>("#strength-slider")!;
    expect(slider.value).toBe("3.35");
    expect(controller.score).toBe(3.35);
    expect(positions.at(-1)).toBe(3.35);
    expect(root.querySelector(".stage-name")?.textContent).toBe("梁圣");
    expect(root.querySelector(".level-output")?.textContent).toBe("+03");
  });

  it("初始状态显示中立梁子", () => {
    mountApp(root);

    expect(root.querySelector(".stage-name")?.textContent).toBe("梁子");
    expect(root.querySelector(".level-output")?.textContent).toBe("00");
    expect(root.querySelector(".load-state")?.textContent).toBe("载入连续祖力…");
  });

  it("只展示本机手动校准说明，不展示未完成的在线功能文案", () => {
    mountApp(root);

    const status = root.querySelector(".calibration-status")!;
    expect(status.textContent).toBe("拖动滑片即可连续校准，当前位置会保存在本机");
    expect(status.getAttribute("role")).toBe("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(root.querySelector(".drag-hint")?.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "← 拖动滑片连续校准。−15 最弱，0 居中，+15 最强；松开后记住当前位置。 →",
    );
    expect(root.textContent).not.toMatch(/投票|社区平均/u);
  });

  it("用直白文案说明自动模式和手动降级", () => {
    const controller = mountApp(root);
    const status = root.querySelector<HTMLElement>(".calibration-status")!;

    controller.setReady();
    controller.setAppMode("news");
    expect(status.textContent).toBe("由今日 AI 新闻自动校准，变阻器将跟随分析结果");
    expect(controller.slider.disabled).toBe(true);
    controller.setAppMode("chat");
    expect(status.textContent).toBe("由当前对话自动校准，变阻器将平滑移动到分析结果");

    controller.setAppMode("manual");
    controller.setVoteError();
    expect(status.textContent).toBe("在线状态暂不可用，仍可继续手动校准");
    controller.setCommunityUnavailable();
    expect(status.textContent).toBe("在线状态暂不可用，仍可继续手动校准");
  });

  it("手动模式可随时拖动并保存位置", () => {
    const controller = mountApp(root);
    const votes: number[] = [];
    controller.onVote = (position) => {
      votes.push(position);
      controller.restoreVote(6);
    };
    controller.setReady();
    controller.setUserVotePosition(6);

    const slider = controller.slider;
    slider.value = "11";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    expect(controller.score).toBe(11);
    expect(slider.disabled).toBe(false);

    slider.dispatchEvent(new Event("change", { bubbles: true }));
    expect(controller.score).toBe(6);
    expect(slider.value).toBe("6");
    expect(votes).toEqual([11]);
    expect(root.querySelector(".calibration-status")?.textContent).toBe(
      "拖动滑片即可连续校准，当前位置会保存在本机",
    );
  });

  it("在线基线不会覆盖已经保存的本机位置", () => {
    const controller = mountApp(root);
    const score = {
      score: 2.5, stage: "梁圣", voterCount: 4,
      positiveCount: 3, negativeCount: 1, neutralCount: 0,
      positivePoints: 13, negativePoints: -3,
    };
    controller.setReady();
    controller.setUserVotePosition(6);
    controller.restoreVote(6);
    controller.setCommunityScore(score);

    expect(controller.score).toBe(6);
    expect(root.querySelector(".community-ghost-thumb, .vote-total")).toBeNull();
  });

  it("较慢的投票响应不会打断第二次拖动预览", async () => {
    const controller = mountApp(root);
    controller.setReady();
    let releaseVote!: () => void;
    const firstResponse = new Promise<void>((resolve) => {
      releaseVote = resolve;
    });
    const submitted: number[] = [];
    controller.onVote = async (position) => {
      submitted.push(position);
      if (submitted.length === 1) {
        await firstResponse;
        controller.setUserVotePosition(7);
        controller.setCommunityScore({
          score: 3, stage: "梁圣", voterCount: 5,
          positiveCount: 4, negativeCount: 1, neutralCount: 0,
          positivePoints: 18, negativePoints: -3,
        });
        controller.restoreVote(7);
        return;
      }
      controller.restoreVote(7);
    };

    controller.slider.value = "8";
    controller.slider.dispatchEvent(new Event("input", { bubbles: true }));
    controller.slider.dispatchEvent(new Event("change", { bubbles: true }));
    controller.slider.value = "-5";
    controller.slider.dispatchEvent(new Event("input", { bubbles: true }));
    releaseVote();
    await firstResponse;
    await Promise.resolve();

    expect(controller.score).toBe(-5);
    expect(controller.slider.value).toBe("-5");
    expect(submitted).toEqual([8]);

    controller.slider.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
    expect(submitted).toEqual([8, -5]);
    expect(controller.score).toBe(7);
  });

  it("异步投票响应不会打断历史模式，退出后恢复个人票", async () => {
    const controller = mountApp(root);
    controller.setReady();
    let releaseVote!: () => void;
    const voteResponse = new Promise<void>((resolve) => {
      releaseVote = resolve;
    });
    controller.onVote = async () => {
      await voteResponse;
      controller.setUserVotePosition(7);
      controller.setCommunityScore({
        score: 3, stage: "梁圣", voterCount: 5,
        positiveCount: 4, negativeCount: 1, neutralCount: 0,
        positivePoints: 18, negativePoints: -3,
      });
      controller.restoreVote(7);
    };
    controller.slider.value = "7";
    controller.slider.dispatchEvent(new Event("input", { bubbles: true }));
    controller.slider.dispatchEvent(new Event("change", { bubbles: true }));
    controller.enterHistoryMode("2026-08-13", -8);
    releaseVote();
    await voteResponse;
    await Promise.resolve();

    expect(controller.score).toBe(-8);
    expect(controller.slider.disabled).toBe(true);
    expect(root.querySelector(".experience")?.classList.contains("is-history-mode")).toBe(true);
    expect(root.querySelector<HTMLButtonElement>(".timeline-return-btn")?.hidden).toBe(false);
    expect(root.querySelector(".timeline-header")?.textContent).toBe("2026-08-13");

    controller.setVoteError();
    controller.restoreVote(7);
    expect(controller.score).toBe(-8);
    controller.exitHistoryMode();
    expect(controller.score).toBe(7);
    expect(controller.slider.disabled).toBe(false);
  });

  it("首帧绘制后立即撤去遮罩，但继续锁定滑杆直到视频就绪", () => {
    const controller = mountApp(root);
    const slider = root.querySelector<HTMLInputElement>("#strength-slider")!;
    const loadState = root.querySelector<HTMLElement>(".load-state")!;

    controller.setFirstFrameReady();

    expect(loadState.hidden).toBe(true);
    expect(slider.disabled).toBe(true);

    controller.setReady();

    expect(slider.disabled).toBe(false);
  });

  it("拖到 +9 后同步更新梁神文字和无障碍读数", () => {
    mountApp(root);

    const slider = root.querySelector<HTMLInputElement>("#strength-slider")!;
    slider.value = "9";
    slider.dispatchEvent(new Event("input", { bubbles: true }));

    expect(root.querySelector(".stage-name")?.textContent).toBe("梁神");
    expect(slider.getAttribute("aria-valuetext")).toBe(
      "梁神，强度 +09，范围 -15 到 +15",
    );
  });

  it("滑动结束后将连续预览位置量化为整数并保存", () => {
    const controller = mountApp(root);
    const positions: number[] = [];
    controller.onVote = (position) => positions.push(position);

    const slider = root.querySelector<HTMLInputElement>("#strength-slider")!;
    slider.value = "8.6";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    slider.dispatchEvent(new Event("change", { bubbles: true }));
    expect(positions).toEqual([9]);
    expect(slider.value).toBe("8.6");
  });

  it("在线基线可以设置初始连续分值", () => {
    const controller = mountApp(root);

    controller.setCommunityScore({
      score: 7.5,
      stage: "梁圣",
      positiveCount: 2,
      negativeCount: 0,
      neutralCount: 0,
      positivePoints: 15,
      negativePoints: 0,
      voterCount: 2,
    });
    const slider = root.querySelector<HTMLInputElement>("#strength-slider")!;

    expect(slider.value).toBe("7.5");
    expect(root.querySelector(".stage-name")?.textContent).toBe("梁圣");
  });

  it("已经保存的本机位置优先于随后到达的在线基线", () => {
    const controller = mountApp(root);

    controller.setUserVotePosition(6);
    controller.setCommunityScore({
      score: 2.4,
      stage: "梁圣",
      positiveCount: 2,
      negativeCount: 1,
      neutralCount: 0,
      positivePoints: 12,
      negativePoints: -3,
      voterCount: 3,
    });

    expect(controller.score).toBe(6);
  });

  it("显示六个命名节点", () => {
    mountApp(root);

    const labels = Array.from(root.querySelectorAll(".stage-marker"), (node) =>
      node.textContent?.trim(),
    );

    expect(labels).toEqual(["小难梁", "牢梁", "梁子", "梁圣", "梁神", "梁祖"]);
  });

  it("在手动、新闻和对话模式之间切换且不触发手动保存", () => {
    const controller = mountApp(root);
    const modes: string[] = [];
    const votes: number[] = [];
    controller.onModeChange = (mode) => modes.push(mode);
    controller.onVote = (position) => votes.push(position);
    controller.setReady();

    root.querySelector<HTMLButtonElement>('[data-mode="news"]')!.click();
    expect(root.querySelector<HTMLElement>(".news-panel")!.hidden).toBe(false);
    expect(controller.slider.disabled).toBe(true);
    root.querySelector<HTMLButtonElement>('[data-mode="chat"]')!.click();
    expect(root.querySelector<HTMLElement>(".chat-panel")!.hidden).toBe(false);
    root.querySelector<HTMLButtonElement>('[data-mode="manual"]')!.click();
    expect(controller.slider.disabled).toBe(false);
    expect(modes).toEqual(["news", "chat", "manual"]);
    expect(votes).toEqual([]);
  });

  it("把新闻和聊天模型输出作为纯文本渲染", () => {
    const controller = mountApp(root);
    controller.setNewsResult({
      date: "2026-08-14", score: 3, stage: "梁圣", headline: "<img src=x>",
      rationale: "<script>bad()</script>",
      dimensions: { originality: 0, openness: 0, efficiency: 0, intelligence: 0, restraint: 0 },
      quote: { id: "q", dimension: "restraint", text: "<b>quote</b>", timestamp: "00:00:01" },
      quoteSource: "https://example.com/original", transcriptSource: "https://example.com/transcript",
      sourceCaveat: "unverified", items: [{
        id: "bad", title: "<img src=x>", summaryZh: "<script>bad()</script>",
        url: "javascript:alert(1)", source: "<b>source</b>",
        publishedAt: "2026-08-14T01:00:00Z", tags: ["**tag**"],
      }], collectedAt: Date.now(),
    });
    controller.setChatResult({
      score: 1, stage: "梁子", answer: "<img src=x onerror=bad()>",
      calibrationSummary: "<script>bad()</script>",
      dimensions: { originality: 0, openness: 0, efficiency: 0, intelligence: 0, restraint: 0 },
      disclaimer: "simulation",
      conversation: { id: "00000000-0000-4000-8000-000000000001", title: "测试" },
    });
    expect(root.querySelector(".news-headline")?.textContent).toBe("<img src=x>");
    expect(root.querySelector(".chat-answer")?.textContent).toContain("<img");
    expect(root.querySelector(".mode-panel script, .mode-panel img")).toBeNull();
    expect(root.querySelector(".news-markdown h3")?.textContent).toContain("<img");
    expect(root.querySelector(".news-markdown a")?.hasAttribute("href")).toBe(false);
  });

  it("renders detailed news collection progress", () => {
    const controller = mountApp(root);
    controller.setNewsLoading();
    controller.setNewsProgress({
      id: "00000000-0000-4000-8000-000000000001",
      status: "running",
      progress: 62,
      stage: "web-search",
      label: "中英双路检索",
      detail: "英文检索完成 · 4 条",
      startedAt: 1_000,
      updatedAt: 6_000,
      elapsedMs: 5_000,
      stats: { directItems: 7, webItems: 4, sourcesCompleted: 2, sourcesTotal: 2 },
      events: [{
        id: 1, progress: 62, stage: "web-search", label: "中英双路检索",
        detail: "英文检索完成 · 4 条", at: 6_000,
      }],
    });
    expect(root.querySelector(".news-progress-percent")?.textContent).toBe("62%");
    expect(root.querySelector(".news-progress-track")?.getAttribute("aria-valuenow")).toBe("62");
    expect(root.querySelector(".news-progress-detail")?.textContent).toContain("英文检索完成");
    expect(root.querySelector(".metric-direct")?.textContent).toBe("7");
    expect(root.querySelector(".news-progress-events")?.textContent).toContain("中英双路检索");
  });

  it("把事件标题和日期当作纯文本与属性处理", () => {
    const controller = mountApp(root);
    const maliciousDate = '2026-08-13\"><script>window.pwned=1</script>';
    const maliciousTitle = '梁圣\"><img src=x onerror=alert(1)>';
    const selected: string[] = [];
    controller.onHistorySelect = (date) => selected.push(date);

    controller.setTimelineEvents([{
      id: 1,
      date: maliciousDate,
      title: maliciousTitle,
      summary: null,
      isMajor: false,
    }]);

    const button = root.querySelector<HTMLButtonElement>(".timeline-node")!;
    expect(root.querySelector(".timeline-track script, .timeline-track img")).toBeNull();
    expect(button.dataset.date).toBe(maliciousDate);
    expect(button.dataset.title).toBe(maliciousTitle);
    expect(button.getAttribute("aria-label")).toBe(`${maliciousDate}: ${maliciousTitle}`);
    expect(button.textContent).toContain(maliciousDate.slice(5));
    button.click();
    expect(selected).toEqual([maliciousDate]);
  });

  it("侧边栏渲染历史对话，支持打开与删除且高亮当前项", () => {
    const controller = mountApp(root);
    const selected: string[] = [];
    const deleted: string[] = [];
    controller.onConversationSelect = (id) => selected.push(id);
    controller.onConversationDelete = (id) => deleted.push(id);

    controller.setChatConversations([
      {
        id: "00000000-0000-4000-8000-000000000001",
        title: "先做原创研究",
        messageCount: 3,
        lastScore: 6,
        lastStage: "梁圣",
        createdAt: 1,
        updatedAt: 2,
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        title: "要不要追热点",
        messageCount: 1,
        lastScore: -9,
        lastStage: "牢梁",
        createdAt: 1,
        updatedAt: 3,
      },
    ]);
    controller.setActiveConversationId("00000000-0000-4000-8000-000000000001");

    const items = Array.from(root.querySelectorAll<HTMLElement>(".chat-conversation"));
    expect(items).toHaveLength(2);
    expect(items[0]?.classList.contains("is-active")).toBe(true);
    expect(items[1]?.classList.contains("is-active")).toBe(false);
    expect(items[0]?.querySelector(".chat-conversation-meta")?.textContent).toContain("3 条");
    expect(items[0]?.querySelector(".chat-conversation-meta")?.textContent).toContain("梁圣 +6");

    items[0]?.querySelector<HTMLButtonElement>(".chat-conversation-open")?.click();
    items[1]?.querySelector<HTMLButtonElement>(".chat-conversation-delete")?.click();
    expect(selected).toEqual(["00000000-0000-4000-8000-000000000001"]);
    expect(deleted).toEqual(["00000000-0000-4000-8000-000000000002"]);
    expect(root.querySelector(".chat-sidebar-empty")?.hasAttribute("hidden")).toBe(true);
  });

  it("载入历史对话时按消息渲染，并为每次回答回显分值", () => {
    const controller = mountApp(root);

    controller.setChatThread([
      { role: "user", content: "先做原创研究", score: null, stage: null, createdAt: 1 },
      { role: "assistant", content: "我们可以先看真正的瓶颈。", score: 6, stage: "梁圣", createdAt: 2 },
      { role: "user", content: "下一步呢？", score: null, stage: null, createdAt: 3 },
      { role: "assistant", content: "把技术瓶颈量化。", score: -3, stage: "梁子", createdAt: 4 },
    ]);

    expect(root.querySelectorAll(".chat-turn--user")).toHaveLength(2);
    expect(root.querySelectorAll(".chat-turn--assistant")).toHaveLength(2);
    const badges = Array.from(root.querySelectorAll<HTMLElement>(".chat-turn-score"));
    expect(badges).toHaveLength(2);
    expect(badges[0]?.textContent).toBe("梁圣 · +6");
    expect(badges[1]?.textContent).toBe("梁子 · -3");
    expect(root.querySelector(".chat-empty")).toBeNull();
  });

  it("新对话按钮清空线程并触发回调", () => {
    const controller = mountApp(root);
    const started: number[] = [];
    controller.onNewConversation = () => started.push(1);

    controller.setChatThread([
      { role: "user", content: "旧问题", score: null, stage: null, createdAt: 1 },
      { role: "assistant", content: "旧回答", score: 2, stage: "梁圣", createdAt: 2 },
    ]);
    controller.clearChatThread();

    expect(root.querySelectorAll(".chat-turn")).toHaveLength(0);
    expect(root.querySelector(".chat-empty")?.textContent).toContain("新对话");
    root.querySelector<HTMLButtonElement>(".chat-new-btn")?.click();
    expect(started).toEqual([1]);
  });

  it("Enter 发送消息，Shift+Enter 与输入法组词不提交", () => {
    const controller = mountApp(root);
    const submitted: string[] = [];
    controller.onChatSubmit = (message) => submitted.push(message);
    const input = root.querySelector<HTMLTextAreaElement>("#chat-input")!;

    input.value = "先做原创研究";
    input.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter", bubbles: true, cancelable: true,
    }));
    expect(submitted).toEqual(["先做原创研究"]);

    input.value = "换行内容";
    input.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter", shiftKey: true, bubbles: true, cancelable: true,
    }));
    expect(submitted).toEqual(["先做原创研究"]);

    input.value = "组词内容";
    input.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter", isComposing: true, bubbles: true, cancelable: true,
    }));
    expect(submitted).toEqual(["先做原创研究"]);
  });

  it("生成中按钮变为方块图标，完成后恢复箭头", () => {
    const controller = mountApp(root);
    const button = root.querySelector<HTMLButtonElement>(".chat-submit-btn")!;
    const sendIcon = button.querySelector(".chat-submit-icon--send");
    const stopIcon = button.querySelector(".chat-submit-icon--stop");

    expect(button.getAttribute("aria-label")).toBe("发送");
    expect(sendIcon).not.toBeNull();
    expect(stopIcon).not.toBeNull();
    expect(button.classList.contains("is-loading")).toBe(false);

    controller.setChatLoading("先做原创研究");
    expect(button.classList.contains("is-loading")).toBe(true);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-label")).toBe("生成中");

    controller.setChatResult({
      score: 6,
      stage: "梁圣",
      answer: "先看真正的瓶颈。",
      calibrationSummary: "偏向主线。",
      dimensions: { originality: 0.4, openness: 0.2, efficiency: 0.2, intelligence: 0.6, restraint: 0.2 },
      disclaimer: "simulation",
      conversation: { id: "00000000-0000-4000-8000-000000000001", title: "测试" },
    });
    expect(button.classList.contains("is-loading")).toBe(false);
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-label")).toBe("发送");

    controller.setChatLoading("再来一次");
    controller.setChatError("失败了");
    expect(button.classList.contains("is-loading")).toBe(false);
    expect(button.getAttribute("aria-label")).toBe("发送");
  });
});
