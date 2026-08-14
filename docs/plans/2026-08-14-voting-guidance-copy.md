# Clear Voting Guidance Copy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the ambiguous voting guidance with direct copy that explains the two slider markers, the submission moment, the score direction, and the current personal/community results.

**Architecture:** Keep the existing DOM structure and voting flow. Add one small formatter and one `renderVoteStatus()` function inside `mountApp()` so `setCommunityScore()` and `setUserVotePosition()` can arrive in either order while always producing the same status text. Cover static, dynamic, and responsive behavior with Vitest and Playwright.

**Tech Stack:** TypeScript, DOM APIs, Vitest with jsdom, Playwright, Vite

---

### Task 1: Specify the new static and dynamic copy

**Files:**
- Modify: `src/app.test.ts`

**Step 1: Write the failing tests**

Add a test for the initial explanatory copy:

```ts
it("直接说明圆点含义、提交方式和分值方向", () => {
  mountApp(root);

  expect(root.querySelector(".vote-status")?.textContent).toBe(
    "红色圆点是你的选择，灰色圆点是社区平均分",
  );
  expect(root.querySelector(".drag-hint")?.textContent?.replace(/\s+/g, " ").trim()).toBe(
    "← 拖动红色圆点，松开即提交。−15 最弱，0 居中，+15 最强；当天可随时修改。 →",
  );
});
```

Replace the loose assertions in `默认展示社区连续分值，并把用户投票位置作为独立信息保留` with an exact status assertion:

```ts
expect(status.textContent).toBe("你的投票：+15　社区平均：+7.5");
```

Add an order-independence test matching the post-vote call order in `src/main.ts`:

```ts
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
    isColdStart: true,
    recentEvents: [],
  });

  expect(root.querySelector(".vote-status")?.textContent).toBe(
    "你的投票：+6　社区平均：+2.4",
  );
});
```

**Step 2: Run the focused tests and verify they fail**

Run:

```bash
npm test -- --run src/app.test.ts
```

Expected: FAIL because the page still says `主滑块`、`阴影圆点` and `0 为中立`, and the dynamic status does not include the community score.

### Task 2: Render the approved copy from shared state

**Files:**
- Modify: `src/app.ts:133-156`
- Modify: `src/app.ts:191-316`
- Test: `src/app.test.ts`

**Step 1: Replace the static strings**

Use the approved initial copy:

```html
<p class="vote-status">红色圆点是你的选择，灰色圆点是社区平均分</p>
```

Replace the lower hint while retaining the decorative arrows:

```html
<p class="drag-hint"><span aria-hidden="true">←</span> 拖动红色圆点，松开即提交。−15 最弱，0 居中，+15 最强；当天可随时修改。 <span aria-hidden="true">→</span></p>
```

**Step 2: Add a compact signed-number formatter**

Place this module-local helper near `formatVoteCount()`:

```ts
function formatStatusScore(score: number): string {
  const rounded = Math.round(clampScore(score) * 10) / 10;
  if (Object.is(rounded, -0) || rounded === 0) return "0";
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}
```

This produces `+6`, `+2.4`, `-3`, and `0`, matching the approved examples without the level meter's zero padding.

**Step 3: Centralize status rendering**

After `communityLevel` and `userVotePosition` are declared, add:

```ts
const renderVoteStatus = (): void => {
  if (userVotePosition === null) {
    voteStatus.textContent = "红色圆点是你的选择，灰色圆点是社区平均分";
    return;
  }

  voteStatus.textContent =
    `你的投票：${formatStatusScore(userVotePosition)}`
    + `　社区平均：${formatStatusScore(communityLevel)}`;
};
```

Call `renderVoteStatus()` immediately after assigning `communityLevel` inside `setCommunityScore()` and immediately after assigning `userVotePosition` inside `setUserVotePosition()`. Remove both existing assignments containing `主滑块` or `阴影圆点`.

**Step 4: Run the focused tests and verify they pass**

Run:

```bash
npm test -- --run src/app.test.ts
```

Expected: all tests in `src/app.test.ts` PASS.

**Step 5: Commit the copy behavior**

```bash
git add src/app.ts src/app.test.ts
git commit -m "feat: clarify community voting guidance"
```

### Task 3: Protect the visible copy and responsive layout

**Files:**
- Modify: `tests/slider.spec.ts`

**Step 1: Add browser-level assertions**

Extend `页面包含完整的 31 级控制与六个命名节点` with:

```ts
await expect(page.locator(".vote-status")).toHaveText(
  "红色圆点是你的选择，灰色圆点是社区平均分",
);
await expect(page.locator(".drag-hint")).toContainText(
  "拖动红色圆点，松开即提交。−15 最弱，0 居中，+15 最强；当天可随时修改。",
);
```

The suite already runs this test on desktop and mobile Chromium, while `页面在当前视口没有横向溢出` protects the wider lower sentence from breaking the page.

**Step 2: Run the browser test**

Run:

```bash
npm run test:e2e -- tests/slider.spec.ts
```

Expected: 18 tests PASS across desktop and mobile Chromium.

**Step 3: Commit the browser regression test**

```bash
git add tests/slider.spec.ts
git commit -m "test: cover clearer voting instructions"
```

### Task 4: Run the full verification set

**Files:**
- Verify only

**Step 1: Run the production build**

```bash
npm run build
```

Expected: TypeScript and Vite builds complete without errors.

**Step 2: Run all unit tests**

```bash
npm test -- --run
```

Expected: all Vitest suites PASS.

**Step 3: Run all browser tests**

```bash
npm run test:e2e
```

Expected: all Playwright tests PASS on desktop and mobile Chromium.

**Step 4: Confirm the old wording is gone**

```bash
rg -n "主滑块|阴影圆点|0 为中立|当天再次滑动" src tests
```

Expected: no matches.

**Step 5: Inspect the final diff**

```bash
git status --short
git diff HEAD~2 --check
git diff HEAD~2 -- src/app.ts src/app.test.ts tests/slider.spec.ts
```

Expected: clean whitespace check; only the approved copy, its renderer, and its tests appear in the implementation diff.
