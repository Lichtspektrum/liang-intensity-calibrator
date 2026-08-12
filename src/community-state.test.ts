import { describe, expect, it } from "vitest";

import {
  animateSnapback,
  beginBrowsing,
  createCommunityState,
  enterHistoryMode,
  exitHistoryMode,
  finishSnapback,
  setBrowsingPosition,
  startSnapback,
  updateCommunityScore,
} from "./community-state";

describe("community state machine", () => {
  it("starts in idle mode at initial score", () => {
    const state = createCommunityState(15);
    expect(state.mode).toBe("idle");
    expect(state.communityScore).toBe(15);
    expect(state.currentPosition).toBe(15);
  });

  it("enters browsing mode when user begins dragging", () => {
    let state = createCommunityState(15);
    state = beginBrowsing(state);
    expect(state.mode).toBe("browsing");
  });

  it("updates position while browsing", () => {
    let state = createCommunityState(15);
    state = beginBrowsing(state);
    state = setBrowsingPosition(state, 25);
    expect(state.currentPosition).toBe(25);
  });

  it("does not update position when not browsing", () => {
    const state = createCommunityState(15);
    const updated = setBrowsingPosition(state, 25);
    expect(updated.currentPosition).toBe(15);
  });

  it("snaps back to community score after snap animation", () => {
    let state = createCommunityState(15);
    state = beginBrowsing(state);
    state = setBrowsingPosition(state, 25);
    state = startSnapback(state);
    expect(state.mode).toBe("snapping-back");
    state = finishSnapback(state);
    expect(state.mode).toBe("idle");
    expect(state.currentPosition).toBe(15);
  });

  it("updates community score in idle mode", () => {
    let state = createCommunityState(15);
    state = updateCommunityScore(state, 20);
    expect(state.communityScore).toBe(20);
    expect(state.currentPosition).toBe(20);
  });

  it("does not move current position in browsing mode when score updates", () => {
    let state = createCommunityState(15);
    state = beginBrowsing(state);
    state = setBrowsingPosition(state, 25);
    state = updateCommunityScore(state, 20);
    expect(state.communityScore).toBe(20);
    expect(state.currentPosition).toBe(25);
  });

  it("enters and exits history mode", () => {
    let state = createCommunityState(15);
    state = enterHistoryMode(state, "2026-08-10", 8);
    expect(state.mode).toBe("viewing-history");
    expect(state.currentPosition).toBe(8);
    expect(state.historyDate).toBe("2026-08-10");
    state = exitHistoryMode(state);
    expect(state.mode).toBe("idle");
    expect(state.currentPosition).toBe(15);
    expect(state.historyPosition).toBeNull();
  });

  describe("animateSnapback", () => {
    it("starts at start position", () => {
      const state = startSnapback(setBrowsingPosition(beginBrowsing(createCommunityState(15)), 25));
      const { position, done } = animateSnapback(state, 0, 25);
      expect(position).toBeCloseTo(25);
      expect(done).toBe(false);
    });

    it("ends at target position", () => {
      const state = startSnapback(setBrowsingPosition(beginBrowsing(createCommunityState(15)), 25));
      const { position, done } = animateSnapback(state, 600, 25);
      expect(position).toBeCloseTo(15);
      expect(done).toBe(true);
    });

    it("eases out (slower at end)", () => {
      const state = startSnapback(setBrowsingPosition(beginBrowsing(createCommunityState(15)), 25));
      const mid = animateSnapback(state, 300, 25);
      expect(mid.position).toBeLessThan(25);
      expect(mid.position).toBeGreaterThan(15);
      expect(mid.done).toBe(false);
    });
  });
});
