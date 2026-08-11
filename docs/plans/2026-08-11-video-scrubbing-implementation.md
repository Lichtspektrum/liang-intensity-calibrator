# Interpolated Video Scrubbing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate a free 800×800 interpolated portrait video from the existing 31 frames and use it as a continuously scrubbable Canvas source in the web page.

**Architecture:** A reproducible shell pipeline prepares 800×800 keyframes, invokes a local RIFE executable, and encodes WebM plus MP4 outputs with FFmpeg. The frontend keeps the current Canvas UI, but a hidden video element becomes its image source and the slider maps continuous values from 0 to 30 onto video time.

**Tech Stack:** Bash, RIFE ncnn Vulkan, FFmpeg 8, TypeScript, Vite, Vitest, Playwright, HTMLVideoElement, Canvas 2D

---

### Task 1: Verify the local interpolation toolchain

**Files:**
- Create: `scripts/video/check-toolchain.sh`

**Step 1: Write the toolchain check**

The script must verify `ffmpeg`, `ffprobe`, and an executable supplied through `RIFE_BIN`. Error messages must be written in Simplified Chinese. It must print the detected architecture and tool versions on success.

**Step 2: Run it without RIFE to verify failure**

Run: `bash scripts/video/check-toolchain.sh`

Expected: non-zero exit with `找不到 RIFE 可执行文件`.

**Step 3: Download the macOS arm64 RIFE ncnn Vulkan release outside the repository**

Place the executable and bundled models in a temporary tool directory. Do not commit downloaded binaries or model weights.

**Step 4: Run the check with RIFE**

Run: `RIFE_BIN=/absolute/path/to/rife-ncnn-vulkan bash scripts/video/check-toolchain.sh`

Expected: exit 0 and version information.

**Step 5: Commit**

```bash
git add scripts/video/check-toolchain.sh
git commit -m "build: add video interpolation toolchain check"
```

### Task 2: Build two visual interpolation prototypes

**Files:**
- Create: `scripts/video/build-prototype.sh`
- Create: `output/video-prototype/.gitkeep`
- Modify: `.gitignore`

**Step 1: Add a failing argument-validation check**

Run the script without `RIFE_BIN` and verify it fails before creating output.

**Step 2: Implement frame preparation**

Use FFmpeg to scale and center-crop frames to 800×800. Prepare two sequences:

- `frame-00.png` through `frame-06.png`
- `frame-24.png` through `frame-30.png`

**Step 3: Interpolate each adjacent pair**

Invoke RIFE with a target factor of 8, preserving each source keyframe exactly once. Each seven-keyframe segment must produce 49 frames.

**Step 4: Encode review videos**

Encode each segment as 30fps H.264 MP4 with `yuv420p`, 800×800 output, no audio, and a short GOP suitable for scrubbing.

**Step 5: Verify media metadata**

Run:

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,nb_frames \
  -of default=noprint_wrappers=1 output/video-prototype/*.mp4
```

Expected: width 800, height 800, 49 frames for each prototype.

**Step 6: Inspect representative frames**

Extract and inspect the first, middle, and final frames. Check face identity, glasses, jawline, crown and bead curtains. If RIFE produces unacceptable artifacts in the final segment, retry that segment with FILM before proceeding.

**Step 7: Commit reproducible scripts only**

```bash
git add .gitignore scripts/video/build-prototype.sh output/video-prototype/.gitkeep
git commit -m "build: add interpolated video prototype pipeline"
```

### Task 3: Generate the complete 241-frame media set

**Files:**
- Create: `scripts/video/build-full-video.sh`
- Create: `public/video/liang-evolution.webm`
- Create: `public/video/liang-evolution.mp4`

**Step 1: Add validation for all 31 source frames**

The script must exit before processing if any `frame-00.png` through `frame-30.png` is missing.

**Step 2: Prepare 800×800 keyframes**

Preserve the original ordering and exact milestone frames.

**Step 3: Generate 241 frames**

Use eight temporal intervals per adjacent pair. Verify `(31 - 1) × 8 + 1 = 241` output frames.

**Step 4: Encode browser media**

- WebM: VP9, 30fps, 800×800, short GOP.
- MP4: H.264, `yuv420p`, 30fps, 800×800, short GOP and `faststart`.

**Step 5: Verify output**

Use `ffprobe` to confirm dimensions, frame rate, duration and frame count. Extract the six milestone frames and compare them to levels 0, 6, 12, 18, 24 and 30.

**Step 6: Commit**

```bash
git add scripts/video/build-full-video.sh public/video
git commit -m "feat: add interpolated liang evolution video"
```

### Task 4: Add continuous slider progression

**Files:**
- Modify: `src/app.ts`
- Modify: `src/app.test.ts`
- Modify: `src/progression.ts`
- Modify: `src/progression.test.ts`

**Step 1: Write failing tests**

Test that the range input uses `step="0.01"`, preserves a value such as `12.35`, and still reports the nearest display level and correct stage text.

**Step 2: Run tests to verify failure**

Run: `npm test -- src/app.test.ts src/progression.test.ts --run`

Expected: failures for continuous input and clamping behavior.

**Step 3: Implement continuous position handling**

Keep a continuous clamped position for rendering. Derive the integer level and stage labels separately with the existing progression logic.

**Step 4: Run tests**

Run: `npm test -- src/app.test.ts src/progression.test.ts --run`

Expected: all tests pass.

**Step 5: Commit**

```bash
git add src/app.ts src/app.test.ts src/progression.ts src/progression.test.ts
git commit -m "feat: support continuous liang slider values"
```

### Task 5: Render scrubbed video frames to Canvas

**Files:**
- Create: `src/video-renderer.ts`
- Create: `src/video-renderer.test.ts`
- Modify: `src/main.ts`
- Modify: `src/app.ts`
- Modify: `src/styles.css`
- Remove after migration: `src/portrait-renderer.ts`
- Remove after migration: `src/portrait-renderer.test.ts`

**Step 1: Write failing mapping tests**

Test that positions 0, 15 and 30 map to video times 0, half duration and full duration. Test clamping outside the valid range.

**Step 2: Run tests to verify failure**

Run: `npm test -- src/video-renderer.test.ts --run`

Expected: failure because the renderer does not exist.

**Step 3: Implement video loading and fallback**

Create an off-screen `HTMLVideoElement` with WebM first and MP4 fallback. Keep the slider disabled until metadata and the first drawable frame are ready.

**Step 4: Implement coalesced scrubbing**

Map slider position to `currentTime`, coalesce rapid input events, and draw the decoded frame to Canvas using `requestVideoFrameCallback()` when available. Fall back to `seeked` for older browsers.

**Step 5: Preserve errors and accessibility**

Reuse the existing loading and error state. Keep Canvas labels and six stage markers synchronized with the nearest semantic level.

**Step 6: Run unit tests**

Run: `npm test -- --run`

Expected: all unit tests pass.

**Step 7: Commit**

```bash
git add src
git commit -m "feat: scrub interpolated video on the liang slider"
```

### Task 6: Verify browser behavior and deployment

**Files:**
- Modify: `tests/slider.spec.ts`
- Modify: `README.md`

**Step 1: Write failing browser tests**

Test continuous values, video readiness, Canvas drawing, six milestone mappings, label alignment and absence of horizontal overflow on desktop and mobile.

**Step 2: Run the new browser tests to verify failure**

Run: `npx playwright test --workers=1`

Expected: new video-specific checks fail before the integration is complete.

**Step 3: Update project documentation**

Document the free RIFE pipeline, required local tools, media build commands and browser formats.

**Step 4: Run full verification**

```bash
npm test -- --run
npx playwright test --workers=1
npm run build:pages
git diff --check
```

Expected: all commands exit 0.

**Step 5: Commit and deploy**

```bash
git add tests/slider.spec.ts README.md
git commit -m "test: verify continuous video scrubbing"
git push github HEAD:main
```

Wait for the GitHub Pages workflow to complete, then verify the page and both video assets return HTTP 200.
