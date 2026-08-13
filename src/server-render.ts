import type { ScoreResponse } from "./api/shared";
import {
  INITIAL_STATE_ELEMENT_ID,
  getPosterPath,
  serializeInitialState,
} from "./initial-state";

const APP_MARKER = '<main id="app"></main>';
const HEAD_MARKER = "</head>";

export function renderPage(template: string, scoreData: ScoreResponse): string {
  const posterPath = getPosterPath(scoreData.score);
  const preload = `<link rel="preload" as="image" href="${posterPath}" type="image/webp" fetchpriority="high" />`;
  const initialState = `<script id="${INITIAL_STATE_ELEMENT_ID}" type="application/json">${serializeInitialState(scoreData)}</script>`;
  const app = `<main id="app" data-initial-poster="${posterPath}"><img class="ssr-poster" src="${posterPath}" alt="" width="800" height="800" fetchpriority="high" /></main>${initialState}`;

  if (!template.includes(APP_MARKER) || !template.includes(HEAD_MARKER)) {
    throw new Error("静态页面模板缺少 SSR 注入锚点");
  }

  return template
    .replace(HEAD_MARKER, `    ${preload}\n  ${HEAD_MARKER}`)
    .replace(APP_MARKER, app);
}
