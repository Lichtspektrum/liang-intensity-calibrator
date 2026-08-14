// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatVoteCount, mountApp } from "./app";

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

  it("社区数据未加载前隐藏灰色圆点，成功后再显示", () => {
    const controller = mountApp(root);
    const ghost = root.querySelector<HTMLElement>(".community-ghost-thumb")!;

    expect(ghost.hidden).toBe(true);
    controller.setCommunityUnavailable();
    expect(root.querySelector(".vote-status")?.textContent).toBe("社区数据暂时无法加载");
    expect(ghost.hidden).toBe(true);

    controller.setCommunityScore({
      score: 2.5,
      stage: "梁圣",
      voterCount: 4,
      todayVoterCount: 2,
      positiveCount: 3,
      negativeCount: 1,
      neutralCount: 0,
      positivePoints: 13,
      negativePoints: -3,
    });
    expect(ghost.hidden).toBe(false);
  });

  it("直接说明圆点含义、提交方式和分值方向", () => {
    mountApp(root);

    const status = root.querySelector(".vote-status")!;
    expect(status.textContent).toBe(
      "红色圆点是你的选择，灰色圆点是社区平均分",
    );
    expect(status.getAttribute("role")).toBe("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(root.querySelector(".drag-hint")?.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "← 拖动红色圆点，松开即提交。−15 最弱，0 居中，+15 最强；每 3 小时可修改一次。 →",
    );
  });

  it("用直白文案说明冷却、提交失败和社区加载失败", () => {
    const controller = mountApp(root);
    const status = root.querySelector<HTMLElement>(".vote-status")!;

    controller.setReady();
    controller.setCooldown(2 * 60 * 60 * 1_000 + 18 * 60 * 1_000, true);
    expect(status.textContent).toBe("还需 2 小时 18 分才能修改投票");
    expect(controller.slider.disabled).toBe(false);

    controller.setCooldown(18 * 60 * 1_000, true);
    expect(status.textContent).toBe("还需 18 分才能修改投票");
    controller.setCooldown(2 * 60 * 60 * 1_000, true);
    expect(status.textContent).toBe("还需 2 小时才能修改投票");

    controller.setVoteError();
    expect(status.textContent).toBe("提交失败，请稍后重试");
    controller.setCommunityUnavailable();
    expect(status.textContent).toBe("提交失败，请稍后重试");
  });

  it("冷却时仍可预览，恢复已保存位置时不二次投票", () => {
    const controller = mountApp(root);
    const votes: number[] = [];
    controller.onVote = (position) => {
      votes.push(position);
      controller.restoreVote(6);
    };
    controller.setReady();
    controller.setUserVotePosition(6);
    controller.setCooldown(60_000, true);

    const slider = controller.slider;
    slider.value = "11";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    expect(controller.score).toBe(11);
    expect(slider.disabled).toBe(false);

    slider.dispatchEvent(new Event("change", { bubbles: true }));
    expect(controller.score).toBe(6);
    expect(slider.value).toBe("6");
    expect(votes).toEqual([11]);
    expect(root.querySelector(".vote-status")?.textContent).toBe(
      "还需 1 分才能修改投票",
    );
  });

  it("冷却归零后在社区分数到达前显示加载中", () => {
    const controller = mountApp(root);
    controller.setUserVotePosition(6);
    controller.setCooldown(1);
    controller.setCooldown(0);

    expect(root.querySelector(".vote-status")?.textContent).toBe(
      "你的投票：+6　社区平均加载中",
    );

    controller.setCommunityScore({
      score: 2.5, stage: "梁圣", voterCount: 4, todayVoterCount: 2,
      positiveCount: 3, negativeCount: 1, neutralCount: 0,
      positivePoints: 13, negativePoints: -3,
    });
    expect(root.querySelector(".vote-status")?.textContent).toBe(
      "你的投票：+6　社区平均：+2.5　今日 2 人投票　累计 4 人",
    );
  });

  it("投票提交后 2 秒淡出冷却提示，淡入常态统计", async () => {
    vi.useFakeTimers();
    try {
      const controller = mountApp(root);
      const status = root.querySelector<HTMLElement>(".vote-status")!;
      controller.setUserVotePosition(6);
      controller.setCommunityScore({
        score: 2.5, stage: "梁圣", voterCount: 4, todayVoterCount: 2,
        positiveCount: 3, negativeCount: 1, neutralCount: 0,
        positivePoints: 13, negativePoints: -3,
      });
      controller.setCooldown(2 * 60 * 60 * 1_000, true);

      expect(status.textContent).toBe("还需 2 小时才能修改投票");
      expect(status.style.opacity).toBe("");

      await vi.advanceTimersByTimeAsync(2000);
      // 2 秒后开始淡出：文案尚未切换，但已透明
      expect(status.style.opacity).toBe("0");
      expect(status.textContent).toBe("还需 2 小时才能修改投票");

      await vi.advanceTimersByTimeAsync(250);
      // 淡出完成后换成常态文案并淡入
      expect(status.textContent).toBe(
        "你的投票：+6　社区平均：+2.5　今日 2 人投票　累计 4 人",
      );
      expect(status.style.opacity).toBe("");

      // 冷却期间的分钟级更新不再弹冷却提示
      controller.setCooldown(30 * 60 * 1_000);
      expect(status.textContent).toBe(
        "你的投票：+6　社区平均：+2.5　今日 2 人投票　累计 4 人",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("页面加载恢复冷却时不弹提示，直接显示常态统计", () => {
    const controller = mountApp(root);
    controller.setUserVotePosition(6);
    controller.setCommunityScore({
      score: 2.5, stage: "梁圣", voterCount: 4, todayVoterCount: 2,
      positiveCount: 3, negativeCount: 1, neutralCount: 0,
      positivePoints: 13, negativePoints: -3,
    });
    controller.setCooldown(60 * 1_000);

    expect(root.querySelector(".vote-status")?.textContent).toBe(
      "你的投票：+6　社区平均：+2.5　今日 2 人投票　累计 4 人",
    );
  });

  it("社区响应会补上灰点和统计，但不覆盖冷却或错误状态", () => {
    const controller = mountApp(root);
    const score = {
      score: 2.5, stage: "梁圣", voterCount: 4, todayVoterCount: 2,
      positiveCount: 3, negativeCount: 1, neutralCount: 0,
      positivePoints: 13, negativePoints: -3,
    };
    controller.setReady();
    controller.setUserVotePosition(6);
    controller.restoreVote(6);
    controller.setCooldown(60_000, true);
    controller.setCommunityUnavailable();
    expect(root.querySelector(".vote-status")?.textContent).toBe("还需 1 分才能修改投票");
    expect(root.querySelector<HTMLElement>(".community-ghost-thumb")?.hidden).toBe(true);
    controller.setCooldown(0);
    expect(root.querySelector(".vote-status")?.textContent).toBe("社区数据暂时无法加载");
    controller.setCommunityScore(score);

    expect(controller.score).toBe(6);
    expect(root.querySelector<HTMLElement>(".community-ghost-thumb")?.hidden).toBe(false);
    expect(root.querySelector(".vote-status")?.textContent).toBe(
      "你的投票：+6　社区平均：+2.5　今日 2 人投票　累计 4 人",
    );

    controller.setVoteError();
    controller.setCommunityUnavailable();
    expect(root.querySelector(".vote-status")?.textContent).toBe("提交失败，请稍后重试");
    expect(root.querySelector<HTMLElement>(".community-ghost-thumb")?.hidden).toBe(true);
    controller.setCommunityScore(score);
    expect(controller.score).toBe(6);
    expect(root.querySelector(".vote-status")?.textContent).toBe("提交失败，请稍后重试");
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
          score: 3, stage: "梁圣", voterCount: 5, todayVoterCount: 1,
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
        score: 3, stage: "梁圣", voterCount: 5, todayVoterCount: 1,
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

  it("滑动结束后将连续预览位置量化为整数投票，并保留端点计数", () => {
    const controller = mountApp(root);
    const positions: number[] = [];
    controller.onVote = (position) => positions.push(position);

    const slider = root.querySelector<HTMLInputElement>("#strength-slider")!;
    slider.value = "8.6";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    slider.dispatchEvent(new Event("change", { bubbles: true }));
    controller.setVotingState({
      voterCount: 1_110,
      todayVoterCount: 100,
      positiveCount: 1_100,
      negativeCount: 8,
      neutralCount: 2,
      positivePoints: 33_000,
      negativePoints: -40,
    });

    expect(positions).toEqual([9]);
    expect(slider.value).toBe("8.6");
    expect(root.querySelector(".vote-total--up number-flow")?.getAttribute("value")).toBe("1100");
    expect(root.querySelector(".vote-total--down number-flow")?.getAttribute("value")).toBe("8");
    expect(root.querySelector(".vote-btn")).toBeNull();
  });

  it("默认展示社区连续分值，并把用户投票位置作为独立信息保留", () => {
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
      todayVoterCount: 2,
    });
    controller.setUserVotePosition(15);

    const slider = root.querySelector<HTMLInputElement>("#strength-slider")!;
    const ghostThumb = root.querySelector<HTMLElement>(".community-ghost-thumb")!;
    const status = root.querySelector<HTMLElement>(".vote-status")!;

    expect(slider.value).toBe("7.5");
    expect(root.querySelector(".stage-name")?.textContent).toBe("梁圣");
    expect(status.textContent).toBe(
      "你的投票：+15　社区平均：+7.5　今日 2 人投票　累计 2 人",
    );
    expect(ghostThumb.style.getPropertyValue("--community-position")).toBe("75");
  });

  it("先记录个人投票再更新社区分数时刷新完整状态", () => {
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
      todayVoterCount: 1,
    });

    expect(root.querySelector(".vote-status")?.textContent).toBe(
      "你的投票：+6　社区平均：+2.4　今日 1 人投票　累计 3 人",
    );
    expect(controller.score).toBe(6);
  });

  it("显示六个命名节点", () => {
    mountApp(root);

    const labels = Array.from(root.querySelectorAll(".stage-marker"), (node) =>
      node.textContent?.trim(),
    );

    expect(labels).toEqual(["小难梁", "牢梁", "梁子", "梁圣", "梁神", "梁祖"]);
  });

  it("把时间线标题和日期当作纯文本与属性处理", () => {
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
    expect(root.querySelector("script, img")).toBeNull();
    expect(button.dataset.date).toBe(maliciousDate);
    expect(button.dataset.title).toBe(maliciousTitle);
    expect(button.getAttribute("aria-label")).toBe(`${maliciousDate}: ${maliciousTitle}`);
    expect(button.textContent).toContain(maliciousDate.slice(5));
    button.click();
    expect(selected).toEqual([maliciousDate]);
  });
});

describe("formatVoteCount", () => {
  it("uses compact K, M, and B suffixes for large vote counts", () => {
    expect(formatVoteCount(999)).toBe("999");
    expect(formatVoteCount(1_100)).toBe("1.1K");
    expect(formatVoteCount(10_000)).toBe("10K");
    expect(formatVoteCount(1_100_000)).toBe("1.1M");
    expect(formatVoteCount(1_000_000_000)).toBe("1B");
  });
});
