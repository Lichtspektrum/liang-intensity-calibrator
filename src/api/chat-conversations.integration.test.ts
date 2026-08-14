import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { handleApiRequest } from "./app";
import { LocalDatabase } from "../database";
import type { Env } from "./shared";

const ALLOWED_ORIGIN = "http://127.0.0.1:5173";
const CONVERSATION_ID = "00000000-0000-4000-8000-000000000001";
const migrations = fileURLToPath(new URL("../../migrations", import.meta.url));

function apiRequest(path: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("Origin", ALLOWED_ORIGIN);
  headers.set("X-Client-IP", "203.0.113.9");
  return new Request(`http://127.0.0.1:8787${path}`, { ...init, headers });
}

function postJson(path: string, body: unknown): Request {
  return apiRequest(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("chat conversations against real SQLite", () => {
  let dir = "";
  let db: LocalDatabase | null = null;

  afterEach(() => {
    db?.close();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  function createEnv(): Env {
    dir = mkdtempSync(join(tmpdir(), "liang-chat-conversations-"));
    db = new LocalDatabase(join(dir, "liang.sqlite"), migrations);
    return {
      DB: db,
      AI_RUNNER: vi.fn().mockResolvedValue({
        answer: "先把技术瓶颈量化，再决定资源怎么投。",
        calibrationSummary: "偏向主线与效率约束。",
        dimensions: { originality: 0.5, openness: 0.2, efficiency: 0.4, intelligence: 0.6, restraint: 0.3 },
      }),
      VOTER_HASH_SECRET: "a".repeat(32),
      ALLOWED_ORIGINS: ALLOWED_ORIGIN,
    };
  }

  it("persists every exchange with its score and supports list/get/delete", async () => {
    const env = createEnv();

    const first = await handleApiRequest(
      postJson("/api/chat", { message: "先做原创研究" }),
      env,
    );
    expect(first.status).toBe(200);
    const firstBody = await first.json() as {
      score: number;
      conversation: { id: string; title: string };
    };
    expect(firstBody.conversation.title).toBe("先做原创研究");
    expect(firstBody.conversation.id).toMatch(/^[0-9a-f-]{36}$/u);
    expect(firstBody.score).toBeGreaterThan(0);

    const second = await handleApiRequest(
      postJson("/api/chat", {
        message: "那下一步看什么？",
        conversationId: firstBody.conversation.id,
      }),
      env,
    );
    expect(second.status).toBe(200);
    const secondBody = await second.json() as {
      score: number;
      stage: string;
      conversation: { id: string; title: string };
    };
    expect(secondBody.conversation.id).toBe(firstBody.conversation.id);

    const list = await handleApiRequest(apiRequest("/api/conversations"), env);
    expect(list.status).toBe(200);
    const conversations = await list.json() as Array<{
      id: string;
      messageCount: number;
      lastScore: number;
      lastStage: string;
    }>;
    expect(conversations).toHaveLength(1);
    expect(conversations[0]?.messageCount).toBe(4);
    expect(conversations[0]?.lastScore).toBe(secondBody.score);
    expect(conversations[0]?.lastStage).toBe(secondBody.stage);

    const detail = await handleApiRequest(
      apiRequest(`/api/conversations/${firstBody.conversation.id}`),
      env,
    );
    expect(detail.status).toBe(200);
    const conversation = await detail.json() as {
      messages: Array<{ role: string; score: number | null; stage: string | null }>;
    };
    expect(conversation.messages).toHaveLength(4);
    const assistantMessages = conversation.messages.filter((message) => message.role === "assistant");
    expect(assistantMessages).toHaveLength(2);
    expect(assistantMessages[0]?.score).toBe(firstBody.score);
    expect(assistantMessages[1]?.score).toBe(secondBody.score);
    expect(conversation.messages.filter((message) => message.role === "user")
      .every((message) => message.score === null && message.stage === null)).toBe(true);

    const deleted = await handleApiRequest(
      apiRequest(`/api/conversations/${firstBody.conversation.id}`, { method: "DELETE" }),
      env,
    );
    expect(deleted.status).toBe(204);
    const afterDelete = await handleApiRequest(
      apiRequest(`/api/conversations/${firstBody.conversation.id}`),
      env,
    );
    expect(afterDelete.status).toBe(404);
    const emptyList = await handleApiRequest(apiRequest("/api/conversations"), env);
    await expect(emptyList.json()).resolves.toEqual([]);
  });

  it("keeps the fixed id when continuing an existing conversation", async () => {
    const env = createEnv();

    const first = await handleApiRequest(
      postJson("/api/chat", {
        message: "第一个问题",
        conversationId: CONVERSATION_ID,
      }),
      env,
    );
    expect(first.status).toBe(200);
    const firstBody = await first.json() as { conversation: { id: string; title: string } };
    expect(firstBody.conversation.id).toBe(CONVERSATION_ID);
    expect(firstBody.conversation.title).toBe("第一个问题");

    const second = await handleApiRequest(
      postJson("/api/chat", {
        message: "第二个问题",
        conversationId: CONVERSATION_ID,
      }),
      env,
    );
    expect(second.status).toBe(200);
    const secondBody = await second.json() as { conversation: { title: string } };
    expect(secondBody.conversation.title).toBe("第一个问题");
  });
});
