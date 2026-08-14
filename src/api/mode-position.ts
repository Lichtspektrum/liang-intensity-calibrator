import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { MAX_SCORE, MIN_SCORE } from "../score-domain";
import { jsonResponse, type Env } from "./shared";

export interface ModePositions {
  news: number | null;
  chat: number | null;
}

function defaultPositionFile(): string {
  return join(tmpdir(), "liang-slider-mode-positions.json");
}

function positionFile(env: Env): string {
  return env.MODE_POSITION_FILE ?? defaultPositionFile();
}

function isValidPosition(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
    && value >= MIN_SCORE && value <= MAX_SCORE;
}

function readPositions(env: Env): ModePositions {
  try {
    const raw = readFileSync(positionFile(env), "utf8");
    const parsed = JSON.parse(raw) as Partial<ModePositions>;
    return {
      news: isValidPosition(parsed.news) ? parsed.news : null,
      chat: isValidPosition(parsed.chat) ? parsed.chat : null,
    };
  } catch {
    return { news: null, chat: null };
  }
}

function writePositions(env: Env, positions: ModePositions): void {
  const file = positionFile(env);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(positions), "utf8");
}

export function handleGetModePositions(env: Env): Response {
  return jsonResponse(readPositions(env), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function handlePutModePositions(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return jsonResponse({ error: "invalid_body" }, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  const news = record.news;
  const chat = record.chat;
  if (news !== undefined && news !== null && !isValidPosition(news)) {
    return jsonResponse({ error: "invalid_position" }, { status: 400 });
  }
  if (chat !== undefined && chat !== null && !isValidPosition(chat)) {
    return jsonResponse({ error: "invalid_position" }, { status: 400 });
  }
  if (news === undefined && chat === undefined) {
    return jsonResponse({ error: "invalid_body" }, { status: 400 });
  }
  const current = readPositions(env);
  const next: ModePositions = {
    news: news === undefined ? current.news : news,
    chat: chat === undefined ? current.chat : chat,
  };
  try {
    writePositions(env, next);
  } catch {
    return jsonResponse({ error: "write_failed" }, { status: 500 });
  }
  return jsonResponse(next, { headers: { "Cache-Control": "no-store" } });
}
