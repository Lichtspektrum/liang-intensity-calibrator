import type { ScoreResponse } from "./api/shared";
import { describeScore } from "./score-domain";

export const INITIAL_STATE_ELEMENT_ID = "liang-initial-state";

export function getPosterPath(score: number): string {
  const { frameIndex } = describeScore(score);
  return `/frames/frame-${String(frameIndex).padStart(2, "0")}.webp`;
}

export function serializeInitialState(scoreData: ScoreResponse): string {
  return JSON.stringify(scoreData).replaceAll("<", "\\u003c");
}

export function readInitialState(documentRoot: Document = document): ScoreResponse {
  const element = documentRoot.getElementById(INITIAL_STATE_ELEMENT_ID);
  if (!element?.textContent) {
    throw new Error("缺少服务端初始状态");
  }
  return JSON.parse(element.textContent) as ScoreResponse;
}
