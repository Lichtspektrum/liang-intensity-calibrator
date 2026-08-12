// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { formatVoteCount, mountApp } from "./app";

describe("liang slider app", () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<main id="app"></main>';
    root = document.querySelector<HTMLElement>("#app")!;
  });

  it("渲染 0 到 30 的整数投票滑杆和 31 个刻度", () => {
    mountApp(root);

    const slider = root.querySelector<HTMLInputElement>("#strength-slider")!;
    expect(slider.min).toBe("0");
    expect(slider.max).toBe("30");
    expect(slider.step).toBe("1");
    expect(root.querySelectorAll(".tick")).toHaveLength(31);
  });

  it("保留连续滑动位置并用最近等级更新文字", () => {
    const positions: number[] = [];
    const controller = mountApp(root, (position) => positions.push(position));

    controller.setLevel(12.35);

    const slider = root.querySelector<HTMLInputElement>("#strength-slider")!;
    expect(slider.value).toBe("12.35");
    expect(controller.level).toBe(12.35);
    expect(positions.at(-1)).toBe(12.35);
    expect(root.querySelector(".stage-name")?.textContent).toBe("梁子");
    expect(root.querySelector(".level-output")?.textContent).toBe("12 / 30");
  });

  it("初始状态显示小难梁", () => {
    mountApp(root);

    expect(root.querySelector(".stage-name")?.textContent).toBe("小难梁");
    expect(root.querySelector(".level-output")?.textContent).toBe("00 / 30");
    expect(root.querySelector(".load-state")?.textContent).toBe("载入连续祖力…");
  });

  it("拖到 24 级后同步更新梁神文字和无障碍读数", () => {
    mountApp(root);

    const slider = root.querySelector<HTMLInputElement>("#strength-slider")!;
    slider.value = "24";
    slider.dispatchEvent(new Event("input", { bubbles: true }));

    expect(root.querySelector(".stage-name")?.textContent).toBe("梁神");
    expect(slider.getAttribute("aria-valuetext")).toBe("梁神，24 级，共 30 级");
  });

  it("滑动结束后以当前位置提交投票，并保留端点计数", () => {
    const controller = mountApp(root);
    const positions: number[] = [];
    controller.onVote = (position) => positions.push(position);

    const slider = root.querySelector<HTMLInputElement>("#strength-slider")!;
    slider.value = "24";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    slider.dispatchEvent(new Event("change", { bubbles: true }));
    controller.setVotingState({
      upCount: 1_100,
      downCount: 8,
      upVotePoints: 33_000,
      downVotePoints: 40,
    });

    expect(positions).toEqual([24]);
    expect(slider.value).toBe("24");
    expect(root.querySelector(".vote-total--up number-flow")?.getAttribute("value")).toBe("33000");
    expect(root.querySelector(".vote-total--down number-flow")?.getAttribute("value")).toBe("40");
    expect(root.querySelector(".vote-btn")).toBeNull();
  });

  it("默认展示社区结果，并把用户投票位置作为独立标记保留", () => {
    const controller = mountApp(root);

    controller.setCommunityScore({
      score: 22.5,
      level: 22.5,
      stage: "梁圣",
      upCount: 2,
      downCount: 0,
      upVotePoints: 45,
      downVotePoints: 0,
      isColdStart: true,
      recentEvents: [],
    });
    controller.setUserVotePosition(30);

    const slider = root.querySelector<HTMLInputElement>("#strength-slider")!;
    const ghostThumb = root.querySelector<HTMLElement>(".community-ghost-thumb")!;
    const status = root.querySelector<HTMLElement>(".vote-status")!;

    expect(slider.value).toBe("30");
    expect(root.querySelector(".stage-name")?.textContent).toBe("梁圣");
    expect(status.textContent).toContain("你已投票");
    expect(status.textContent).toContain("阴影圆点是社区结果");
    expect(ghostThumb.style.getPropertyValue("--community-position")).toBe("75");
  });

  it("显示六个命名节点", () => {
    mountApp(root);

    const labels = Array.from(root.querySelectorAll(".stage-marker"), (node) =>
      node.textContent?.trim(),
    );

    expect(labels).toEqual(["小难梁", "牢梁", "梁子", "梁圣", "梁神", "梁祖"]);
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
