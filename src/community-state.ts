import { clampPosition } from "./progression";

export type CommunityMode = "idle" | "browsing" | "snapping-back" | "viewing-history";

export interface CommunityState {
  mode: CommunityMode;
  communityScore: number;
  currentPosition: number;
  historyPosition: number | null;
  historyDate: string | null;
}

const SNAP_DURATION_MS = 600;

export function createCommunityState(initialScore: number): CommunityState {
  return {
    mode: "idle",
    communityScore: initialScore,
    currentPosition: initialScore,
    historyPosition: null,
    historyDate: null,
  };
}

export function beginBrowsing(state: CommunityState): CommunityState {
  return { ...state, mode: "browsing" };
}

export function startSnapback(state: CommunityState): CommunityState {
  if (state.mode !== "browsing") return state;
  return { ...state, mode: "snapping-back" };
}

export function finishSnapback(state: CommunityState): CommunityState {
  if (state.mode !== "snapping-back") return state;
  return { ...state, mode: "idle", currentPosition: state.communityScore };
}

export function enterHistoryMode(state: CommunityState, date: string, position: number): CommunityState {
  return {
    ...state,
    mode: "viewing-history",
    historyPosition: position,
    historyDate: date,
    currentPosition: position,
  };
}

export function exitHistoryMode(state: CommunityState): CommunityState {
  return {
    ...state,
    mode: "idle",
    historyPosition: null,
    historyDate: null,
    currentPosition: state.communityScore,
  };
}

export function updateCommunityScore(state: CommunityState, newScore: number): CommunityState {
  const clamped = clampPosition(newScore);
  if (state.mode === "viewing-history") {
    return { ...state, communityScore: clamped };
  }
  if (state.mode === "idle" || state.mode === "snapping-back") {
    return { ...state, communityScore: clamped, currentPosition: clamped };
  }
  return { ...state, communityScore: clamped };
}

export function setBrowsingPosition(state: CommunityState, position: number): CommunityState {
  if (state.mode !== "browsing") return state;
  return { ...state, currentPosition: clampPosition(position) };
}

export function getTargetPosition(state: CommunityState): number {
  if (state.mode === "viewing-history" && state.historyPosition !== null) {
    return state.historyPosition;
  }
  return state.communityScore;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function animateSnapback(
  state: CommunityState,
  elapsedMs: number,
  startPosition: number,
): { position: number; done: boolean } {
  const target = state.communityScore;
  const t = Math.min(1, elapsedMs / SNAP_DURATION_MS);
  const eased = easeOutCubic(t);
  const position = startPosition + (target - startPosition) * eased;
  return { position, done: t >= 1 };
}
