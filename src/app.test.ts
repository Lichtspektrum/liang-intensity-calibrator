// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { mountApp } from "./app";

describe("liang slider app", () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<main id="app"></main>';
    root = document.querySelector<HTMLElement>("#app")!;
  });

  it("渲染 0 到 30 的强度滑杆和 31 个刻度", () => {
    mountApp(root);

    const slider = root.querySelector<HTMLInputElement>("#strength-slider")!;
    expect(slider.min).toBe("0");
    expect(slider.max).toBe("30");
    expect(slider.step).toBe("0.01");
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
    expect(root.querySelector(".load-state")?.textContent).toBe("载入祖力 0 / 31");
  });

  it("拖到 24 级后同步更新梁神文字和无障碍读数", () => {
    mountApp(root);

    const slider = root.querySelector<HTMLInputElement>("#strength-slider")!;
    slider.value = "24";
    slider.dispatchEvent(new Event("input", { bubbles: true }));

    expect(root.querySelector(".stage-name")?.textContent).toBe("梁神");
    expect(slider.getAttribute("aria-valuetext")).toBe("梁神，24 级，共 30 级");
  });

  it("显示六个命名节点", () => {
    mountApp(root);

    const labels = Array.from(root.querySelectorAll(".stage-marker"), (node) =>
      node.textContent?.trim(),
    );

    expect(labels).toEqual(["小难梁", "牢梁", "梁子", "梁圣", "梁神", "梁祖"]);
  });
});
